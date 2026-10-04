import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { login, logout, readToken } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { sendPasswordLink } from '../lib/mail.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }
    const data = await login(username, password);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  res.json({ user: req.user });
});

router.post('/olvide', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (email) {
      const found = await query('SELECT id, username, name, email FROM users WHERE lower(email) = $1 AND active = true', [email]);
      if (found.rowCount) {
        try {
          await issuePasswordLink(found.rows[0], req);
        } catch (err) {
          console.error('No se envió el link de contraseña:', err.message);
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/restablecer', async (req, res, next) => {
  try {
    const token = String(req.body?.token || '');
    const password = String(req.body?.password || '');
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    const found = await query(
      'SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > now()',
      [token]
    );
    if (!found.rowCount) return res.status(400).json({ error: 'El enlace venció o no es válido' });
    const hash = await bcrypt.hash(password, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, found.rows[0].user_id]);
    await query('DELETE FROM password_resets WHERE user_id = $1', [found.rows[0].user_id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export async function issuePasswordLink(user, req) {
  if (!user.email) {
    const err = new Error('El usuario no tiene email');
    err.status = 400;
    throw err;
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
  await query('INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, token, expires]);
  const base = (config.publicAppUrl || `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const sent = await sendPasswordLink(user, `${base}/restablecer?token=${token}`);
  if (sent?.skipped) {
    const err = new Error('El envío de email no está configurado');
    err.status = 400;
    throw err;
  }
  return sent;
}

router.post('/logout', async (req, res, next) => {
  try {
    await logout(readToken(req) || req.token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
