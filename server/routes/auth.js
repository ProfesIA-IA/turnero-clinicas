import crypto from 'crypto';
import path from 'path';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { Router } from 'express';
import { login, logout, publicUser, readToken } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { sendPasswordLink } from '../lib/mail.js';
import { deleteObject, readObject, saveObject } from '../lib/objectStore.js';

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) cb(null, true);
    else cb(new Error('La foto tiene que ser una imagen'));
  },
});

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

router.put('/me', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    if (req.user.isSystem) return res.status(403).json({ error: 'La cuenta de administrador se configura por variables de entorno' });
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');
    const currentPassword = String(req.body?.currentPassword || '');
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'El email no es válido' });
    }
    if (password && password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (password) {
      const row = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const ok = await bcrypt.compare(currentPassword, row.rows[0]?.password_hash || '');
      if (!ok) return res.status(400).json({ error: 'La contraseña actual no coincide' });
    }
    const params = [name, email || null, phone || null, req.user.id];
    let sql = 'UPDATE users SET name = $1, email = $2, phone = $3 WHERE id = $4';
    if (password) {
      params.splice(3, 0, await bcrypt.hash(password, 10));
      sql = 'UPDATE users SET name = $1, email = $2, phone = $3, password_hash = $4 WHERE id = $5';
    }
    const result = await query(`${sql} RETURNING *`, params);
    res.json({ user: publicUser(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.get('/me/photo', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const result = await query('SELECT photo FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows[0]?.photo) return res.status(404).json({ error: 'Sin foto' });
    const body = await readObject(result.rows[0].photo);
    if (!body) return res.status(404).json({ error: 'Sin foto' });
    const ext = path.extname(result.rows[0].photo).toLowerCase();
    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
    res.setHeader('Content-Type', types[ext] || 'image/jpeg');
    body.pipe(res);
  } catch (err) {
    next(err);
  }
});

router.post('/me/photo', (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  if (req.user.isSystem) return res.status(403).json({ error: 'La cuenta de administrador se configura por variables de entorno' });
  photoUpload.single('photo')(req, res, (err) => {
    if (err) return next(err);
    saveMyPhoto(req, res, next).catch(next);
  });
});

async function saveMyPhoto(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Elegí una imagen' });
    const current = await query('SELECT photo FROM users WHERE id = $1', [req.user.id]);
    const key = `${crypto.randomUUID()}${path.extname(req.file.originalname || '').slice(0, 8) || '.jpg'}`;
    await saveObject(key, req.file.buffer, req.file.mimetype);
    if (current.rows[0]?.photo) await deleteObject(current.rows[0].photo);
    await query('UPDATE users SET photo = $1 WHERE id = $2', [key, req.user.id]);
    const user = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    res.json({ user: publicUser(user.rows[0]) });
  } catch (err) {
    next(err);
  }
}

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
