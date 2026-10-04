import crypto from 'crypto';
import { Router } from 'express';
import { query } from '../db/pool.js';
import { getClinicSettings } from '../lib/availability.js';
import { answerChat, inboundTexts, isBotEnabled, sendKapsoText, setBotEnabled, verifyKapsoSignature } from '../lib/chatbot.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAny } from '../lib/permissions.js';

const router = Router();
const seen = new Set();

router.post('/webhook', async (req, res) => {
  try {
    const settings = await getClinicSettings();
    const signature = req.get('x-webhook-signature');
    const secret = config.kapsoWebhookSecret || settings.chatbot_webhook_secret;
    if (!verifyKapsoSignature(req.rawBody, signature, secret)) {
      return res.status(401).send('Invalid signature');
    }
    const idempotency = req.get('x-idempotency-key');
    if (idempotency) {
      if (seen.has(idempotency)) return res.status(200).send('OK');
      seen.add(idempotency);
      if (seen.size > 500) seen.delete(seen.values().next().value);
    }
    res.status(200).send('OK');
    const origin = config.publicAppUrl || `${req.protocol}://${req.get('host')}`;
    for (const item of inboundTexts(req.body)) {
      const reply = await answerChat(item.text, origin, item.to);
      if (reply) await sendKapsoText({ phoneNumberId: item.phoneNumberId, to: item.to, body: reply });
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).send('Error');
  }
});

export async function kapsoRequest(path, options = {}) {
  if (!config.kapsoApiKey) {
    const error = new Error('Falta la API key de Kapso en el servidor');
    error.status = 400;
    throw error;
  }
  const response = await fetch(`https://api.kapso.ai${path}`, {
    ...options,
    headers: {
      'X-API-Key': config.kapsoApiKey,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || 'Kapso rechazó la solicitud');
    error.status = response.status;
    throw error;
  }
  return data;
}

router.get('/numeros', requireAuth, requireAny('configuracion.editar'), async (_req, res, next) => {
  try {
    const data = await kapsoRequest('/platform/v1/whatsapp/phone_numbers');
    const list = data?.data || data?.phone_numbers || data?.whatsapp_phone_numbers || [];
    res.json({ data: list });
  } catch (err) {
    next(err);
  }
});

router.post('/conectar', requireAuth, requireAny('configuracion.editar'), async (req, res, next) => {
  try {
    const phoneNumberId = String(req.body?.phoneNumberId || '').trim();
    if (!phoneNumberId) return res.status(400).json({ error: 'Elegí un número de WhatsApp' });
    const current = await getClinicSettings();
    const secret = current.chatbot_webhook_secret || cryptoSecret();
    const origin = config.publicAppUrl || `${req.protocol}://${req.get('host')}`;
    await kapsoRequest(`/platform/v1/whatsapp/phone_numbers/${phoneNumberId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify({
        whatsapp_webhook: {
          url: `${origin.replace(/\/$/, '')}/api/kapso/webhook`,
          secret_key: secret,
          events: ['whatsapp.message.received'],
          active: true,
        },
      }),
    });
    const saved = await query(
      `UPDATE clinic_settings
       SET chatbot_phone_number_id = $1, chatbot_webhook_secret = $2, updated_at = now()
       WHERE id = 1 RETURNING chatbot_phone_number_id`,
      [phoneNumberId, secret]
    );
    res.json({ data: saved.rows[0] });
  } catch (err) {
    next(err);
  }
});

function phoneNumberIdOf(settings) {
  return settings.chatbot_phone_number_id || config.kapsoPhoneNumberId;
}

function plainText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.text === 'string') return value.text;
  return '';
}

function messageText(message) {
  const caption = message?.image?.caption || message?.video?.caption || message?.document?.caption || message?.audio?.caption || '';
  const text = plainText(message?.text?.body) || plainText(caption) || plainText(message?.kapso?.transcript);
  if (/^(image|audio|video|document) attached \(/i.test(text)) return plainText(message?.kapso?.transcript);
  if (/^\[unsupported message/i.test(text)) return '';
  return text;
}

function messageMedia(message) {
  const kapso = message?.kapso || {};
  const url = kapso.media_url || kapso.media_data?.url || '';
  if (!/^https:\/\/(api|app)\.kapso\.ai\//.test(url)) return null;
  const contentType = kapso.media_data?.content_type || '';
  const kind = message.type === 'image' || contentType.startsWith('image/')
    ? 'image'
    : message.type === 'audio' || message.type === 'voice' || contentType.startsWith('audio/')
      ? 'audio'
      : message.type === 'video' || contentType.startsWith('video/')
        ? 'video'
        : 'file';
  return {
    kind,
    url,
    filename: kapso.media_data?.filename || message?.document?.filename || 'archivo',
    contentType,
  };
}

function windowOpen(inboundAt) {
  if (!inboundAt) return false;
  const at = new Date(inboundAt).getTime();
  if (Number.isNaN(at)) return false;
  return Date.now() - at < 24 * 60 * 60 * 1000;
}

router.get('/conversaciones', requireAuth, requireAny('configuracion.ver'), async (req, res, next) => {
  try {
    const settings = await getClinicSettings();
    const phoneNumberId = phoneNumberIdOf(settings);
    const status = ['active', 'ended'].includes(req.query.status) ? req.query.status : '';
    const statusQuery = status ? `&status=${status}` : '';
    const data = await kapsoRequest(`/platform/v1/whatsapp/conversations?phone_number_id=${encodeURIComponent(phoneNumberId)}&limit=50${statusQuery}`);
    const rows = data?.data || [];
    const pauses = await query('SELECT phone, enabled FROM chatbot_pauses');
    const paused = new Map(pauses.rows.map((row) => [row.phone, row.enabled]));
    res.json({
      data: rows.map((row) => {
        const phone = String(row.phone_number || '').replace(/\D/g, '');
        const inboundAt = row.kapso?.last_inbound_at || null;
        return {
          id: row.id,
          status: row.status || '',
          phone,
          name: row.kapso?.contact_name || row.phone_number || 'Sin nombre',
          preview: row.kapso?.last_message_text || '',
          at: row.kapso?.last_message_timestamp || row.last_active_at,
          inboundAt,
          canReply: windowOpen(inboundAt),
          botEnabled: paused.get(phone) !== false,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/archivo', requireAuth, requireAny('configuracion.ver'), async (req, res, next) => {
  try {
    const url = String(req.query.url || '');
    if (!/^https:\/\/(api|app)\.kapso\.ai\//.test(url)) return res.status(400).json({ error: 'Archivo inválido' });
    const response = await fetch(url, { headers: { 'X-API-Key': config.kapsoApiKey } });
    if (!response.ok) return res.status(404).json({ error: 'No se pudo abrir el archivo' });
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    next(err);
  }
});

router.get('/conversaciones/:id/mensajes', requireAuth, requireAny('configuracion.ver'), async (req, res, next) => {
  try {
    const settings = await getClinicSettings();
    const phoneNumberId = phoneNumberIdOf(settings);
    const data = await kapsoRequest(`/platform/v1/whatsapp/messages?phone_number_id=${encodeURIComponent(phoneNumberId)}&conversation_id=${encodeURIComponent(req.params.id)}&limit=50`);
    const messages = (data?.data || []).map((message) => ({
      id: message.id,
      text: messageText(message),
      media: messageMedia(message),
      direction: message.kapso?.direction || (message.from ? 'inbound' : 'outbound'),
      at: message.kapso?.created_at || (message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : null),
    })).filter((message) => message.text || message.media).reverse();
    res.json({ data: messages });
  } catch (err) {
    next(err);
  }
});

router.post('/conversaciones/:id/mensaje', requireAuth, requireAny('configuracion.editar'), async (req, res, next) => {
  try {
    const body = String(req.body?.body || '').trim();
    const to = String(req.body?.phone || '').replace(/\D/g, '');
    if (!body || !to) return res.status(400).json({ error: 'Escribí un mensaje' });
    const settings = await getClinicSettings();
    const conversation = await kapsoRequest(`/platform/v1/whatsapp/conversations/${req.params.id}`);
    const inboundAt = conversation?.data?.kapso?.last_inbound_at;
    if (!windowOpen(inboundAt)) {
      return res.status(409).json({ error: 'Pasaron más de 24 horas desde el último mensaje. WhatsApp no permite responder.' });
    }
    await sendKapsoText({ phoneNumberId: phoneNumberIdOf(settings), to, body });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.put('/contactos/:phone', requireAuth, requireAny('configuracion.editar'), async (req, res, next) => {
  try {
    await setBotEnabled(req.params.phone, req.body?.botEnabled !== false);
    res.json({ data: { phone: String(req.params.phone).replace(/\D/g, ''), botEnabled: await isBotEnabled(req.params.phone) } });
  } catch (err) {
    next(err);
  }
});

function cryptoSecret() {
  return `wh_${crypto.randomBytes(24).toString('hex')}`;
}

export default router;
