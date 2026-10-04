import crypto from 'crypto';
import { query } from '../db/pool.js';
import { getClinicSettings } from './availability.js';
import { config } from '../config.js';

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function verifyKapsoSignature(rawBody, signature, secret) {
  if (!secret) return true;
  if (!signature || !rawBody) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const left = Buffer.from(String(signature));
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function inboundTexts(body) {
  const events = body?.batch && Array.isArray(body.data) ? body.data : [body];
  return events.flatMap((event) => {
    const message = event?.message;
    if (!message || message.kapso?.direction === 'outbound' || message.kapso?.passive) return [];
    const text = message.text?.body || message.kapso?.transcript || message.kapso?.content || '';
    const to = message.from || event.conversation?.phone_number;
    const phoneNumberId = event.phone_number_id || event.conversation?.phone_number_id;
    if (!text || !to || !phoneNumberId) return [];
    return [{ text: String(text), to: String(to), phoneNumberId: String(phoneNumberId) }];
  });
}

function hourLabel(value) {
  return `${String(value).padStart(2, '0')}:00`;
}

function timeLabel(value) {
  return String(value).slice(0, 5);
}

export const CHAT_MODELS = ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'];

export const DEFAULT_CHAT_PROMPT = `Sos un asistente digital de la clínica, no una persona. Decilo con naturalidad la primera vez que hablás 😊
Respondé en español, breve y cercano, con emojis en cada mensaje ✨
En el primer mensaje saludá una sola vez 👋, presentate como asistente digital 🤖 y preguntá el nombre.
Cuando te digan el nombre, usalo en los mensajes siguientes. No vuelvas a saludar ni a presentarte si la conversación ya empezó.
Cuando cuentes qué hay para atenderse, decí solo los nombres de los servicios 🩺, los nombres de los profesionales 👩‍⚕️ y los horarios de atención 🕒. No menciones precios, duración ni códigos.
Si piden un turno, además de eso mandá el link de reserva 📅. No inventes horarios ni profesionales.`;

export function chatModel(value) {
  return CHAT_MODELS.includes(value) ? value : CHAT_MODELS[0];
}

export async function answerChat(text, origin, phone) {
  const settings = await getClinicSettings();
  if (settings.chatbot_enabled === false) return '';
  if (!config.openaiApiKey) return 'El asistente todavía no está configurado. Probá de nuevo más tarde.';
  const facts = await clinicFacts(settings, origin);
  const prompt = settings.chatbot_prompt?.trim() || DEFAULT_CHAT_PROMPT;
  const history = await threadMessages(phone);
  const userMessage = { role: 'user', content: text.slice(0, 2000) };
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: chatModel(settings.chatbot_model),
      temperature: 0.4,
      messages: [
        { role: 'system', content: `${prompt}\n\nDatos actuales de la clínica:\n${facts}` },
        ...history,
        userMessage,
      ],
    }),
  });
  if (!response.ok) {
    console.error('OpenAI', response.status);
    return 'Ahora no puedo responder. Escribime de nuevo en un ratito.';
  }
  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim() || 'Contame si querés ver servicios, profesionales, horarios o reservar un turno.';
  await saveThread(phone, [...history, userMessage, { role: 'assistant', content: reply }].slice(-16));
  return reply;
}

async function threadMessages(phone) {
  if (!phone) return [];
  const rows = await query('SELECT messages FROM chatbot_threads WHERE phone = $1', [phone]);
  const messages = rows.rows[0]?.messages;
  return Array.isArray(messages) ? messages.filter((item) => item?.role && item?.content) : [];
}

async function saveThread(phone, messages) {
  if (!phone) return;
  await query(
    `INSERT INTO chatbot_threads (phone, messages, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (phone) DO UPDATE SET messages = EXCLUDED.messages, updated_at = now()`,
    [phone, JSON.stringify(messages)]
  );
}

async function clinicFacts(settings, origin) {
  const base = (origin || config.publicAppUrl || '').replace(/\/$/, '');
  const services = await query(
    `SELECT name, duration_min, price, share_slug, share_enabled FROM services WHERE active ORDER BY name`
  );
  const professionals = await query(
    `SELECT name, share_slug, share_enabled FROM professionals WHERE active ORDER BY name`
  );
  const schedules = await query(
    `SELECT p.name, s.weekday, s.start_time, s.end_time
     FROM schedules s JOIN professionals p ON p.id = s.professional_id
     WHERE p.active ORDER BY p.name, s.weekday, s.start_time`
  );
  const serviceLines = services.rows.map((row) => `- ${row.name}`);
  const professionalLines = professionals.rows.map((row) => `- ${row.name}`);
  const booking = [
    ...services.rows.filter((row) => base && row.share_enabled && row.share_slug).map((row) => `${base}/reservar/servicio/${row.share_slug}`),
    ...professionals.rows.filter((row) => base && row.share_enabled && row.share_slug).map((row) => `${base}/reservar/profesional/${row.share_slug}`),
  ];
  const hours = new Map();
  for (const row of schedules.rows) {
    const line = `${DAYS[row.weekday]} ${timeLabel(row.start_time)}-${timeLabel(row.end_time)}`;
    hours.set(row.name, [...(hours.get(row.name) || []), line]);
  }
  const hourLines = [...hours.entries()].map(([name, slots]) => `- ${name}: ${slots.join(', ')}`);
  return [
    `Nombre: ${settings.name}`,
    `Agenda: ${hourLabel(settings.start_hour)} a ${hourLabel(settings.end_hour)}`,
    `Servicios:\n${serviceLines.join('\n') || '- ninguno'}`,
    `Profesionales:\n${professionalLines.join('\n') || '- ninguno'}`,
    `Horarios de atención:\n${hourLines.join('\n') || '- sin horarios cargados'}`,
    `Link de reserva, solo si piden un turno:\n${booking[0] || '- sin link publicado'}`,
  ].join('\n');
}

export async function sendKapsoText({ phoneNumberId, to, body }) {
  if (!config.kapsoApiKey) throw new Error('Falta KAPSO_API_KEY');
  const response = await fetch(`https://api.kapso.ai/meta/whatsapp/v24.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'X-API-Key': config.kapsoApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: body.slice(0, 4000) },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Kapso ${response.status}: ${detail.slice(0, 300)}`);
  }
}
