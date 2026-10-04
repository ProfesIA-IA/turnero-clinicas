import crypto from 'crypto';
import { Router } from 'express';
import { query } from '../db/pool.js';
import { getClinicSettings } from '../lib/availability.js';
import { answerChat, inboundTexts, sendKapsoText, verifyKapsoSignature } from '../lib/chatbot.js';
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

function cryptoSecret() {
  return `wh_${crypto.randomBytes(24).toString('hex')}`;
}

export default router;
