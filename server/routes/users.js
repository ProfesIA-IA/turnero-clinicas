import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { publicUser } from '../middleware/auth.js';
import { PERMISSIONS, ROLES, normalizePermissions, defaultsFor } from '../lib/permissions.js';
import { issuePasswordLink } from './auth.js';
import { sendPasswordCredentials } from '../lib/mail.js';
import { config } from '../config.js';
import { mountPhotos } from '../lib/photos.js';
import { extraObject } from '../lib/extra.js';
import { likeTerm, pageRequest } from '../lib/paging.js';

const router = Router();
mountPhotos(router, 'users');

const SELECT = `
  SELECT id, username, name, email, photo, role, permissions, professional_id, patient_id, active, is_system, extra, created_at
  FROM users
`;

router.get('/meta', (_req, res) => {
  res.json({
    permissions: PERMISSIONS,
    roles: ROLES,
    defaults: {
      secretaria: defaultsFor('secretaria'),
      profesional: defaultsFor('profesional'),
      paciente: defaultsFor('paciente'),
    },
  });
});

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const paging = pageRequest(req.query);
    const params = [];
    const where = [];
    if (q) {
      params.push(likeTerm(q));
      const n = params.length;
      where.push(`(name ILIKE $${n} OR username ILIKE $${n} OR email ILIKE $${n})`);
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const count = await query(`SELECT count(*)::int AS total FROM users${whereSql}`, params);
    let sql = `${SELECT}${whereSql} ORDER BY is_system DESC, name ASC`;
    if (paging) {
      params.push(paging.limit, paging.offset);
      sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }
    const result = await query(sql, params);
    res.json({
      data: result.rows.map(publicUserRow),
      total: count.rows[0].total,
      page: paging?.page || 1,
      limit: paging?.limit || count.rows[0].total,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = await validateBody(req.body, { creating: true });
    const hash = await bcrypt.hash(body.password, 10);
    const result = await query(
      `INSERT INTO users (username, password_hash, name, email, role, permissions, professional_id, patient_id, active, is_system, extra)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, false, $10::jsonb)
       RETURNING id, username, name, email, role, permissions, professional_id, patient_id, active, is_system, extra, created_at`,
      [
        body.username,
        hash,
        body.name,
        body.email,
        body.role,
        JSON.stringify(body.permissions),
        body.professionalId,
        body.patientId,
        body.active,
        JSON.stringify(body.extra),
      ]
    );
    if (body.sendPassword) await deliverPassword(result.rows[0], body.password, req);
    else if (body.email && (body.sendPasswordLink || !String(req.body?.password || ''))) {
      await issuePasswordLink(result.rows[0], req);
    }
    res.status(201).json({ data: publicUserRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const current = await loadUser(req.params.id);
    if (!current) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (current.is_system) {
      return res.status(403).json({ error: 'El administrador del sistema se gestiona por variables de entorno' });
    }
    const body = await validateBody(req.body, { creating: false, current });
    const params = [
      body.username,
      body.name,
      body.email,
      body.role,
      JSON.stringify(body.permissions),
      body.professionalId,
      body.patientId,
      body.active,
      JSON.stringify(body.extra),
      current.id,
    ];
    let sql = `
      UPDATE users
      SET username = $1, name = $2, email = $3, role = $4, permissions = $5::jsonb,
          professional_id = $6, patient_id = $7, active = $8, extra = $9::jsonb
      WHERE id = $10
    `;
    if (body.password) {
      const hash = await bcrypt.hash(body.password, 10);
      sql = `
        UPDATE users
        SET username = $1, name = $2, email = $3, role = $4, permissions = $5::jsonb,
            professional_id = $6, patient_id = $7, active = $8, extra = $9::jsonb, password_hash = $11
        WHERE id = $10
      `;
      params.push(hash);
    }
    const result = await query(
      `${sql} RETURNING id, username, name, email, role, permissions, professional_id, patient_id, active, is_system, extra, created_at`,
      params
    );
    if (body.sendPassword) await deliverPassword(result.rows[0], body.password, req);
    else if (body.sendPasswordLink) await issuePasswordLink(result.rows[0], req);
    res.json({ data: publicUserRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const current = await loadUser(req.params.id);
    if (!current) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (current.is_system) {
      return res.status(403).json({ error: 'El administrador del sistema no se puede eliminar' });
    }
    if (Number(current.id) === Number(req.user.id)) {
      return res.status(400).json({ error: 'No podés eliminar tu propio usuario' });
    }
    await query('DELETE FROM users WHERE id = $1', [current.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function deliverPassword(user, password, req) {
  const base = (config.publicAppUrl || `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const sent = await sendPasswordCredentials(user, password, `${base}/login`);
  if (sent?.skipped) {
    const err = new Error('El envío de email no está configurado');
    err.status = 400;
    throw err;
  }
}

function publicUserRow(row) {
  return {
    ...publicUser(row),
    createdAt: row.created_at,
  };
}

async function loadUser(id) {
  const result = await query(`${SELECT} WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function validateBody(body, { creating, current }) {
  const username = String(body?.username || '').trim();
  const name = String(body?.name || '').trim();
  const role = String(body?.role || '').trim();
  const password = String(body?.password || '');
  if (!username || !name) {
    const err = new Error('Usuario y nombre son obligatorios');
    err.status = 400;
    throw err;
  }
  if (!ROLES.some((item) => item.key === role)) {
    const err = new Error('Rol inválido');
    err.status = 400;
    throw err;
  }
  const email = String(body?.email || '').trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('El email no es válido');
    err.status = 400;
    throw err;
  }
  if (body?.sendPassword && (!password || !email)) {
    const err = new Error('Para enviar la contraseña cargá el email y una contraseña');
    err.status = 400;
    throw err;
  }
  if (creating && !password && !email) {
    const err = new Error('Cargá una contraseña o un email para enviar el enlace');
    err.status = 400;
    throw err;
  }
  if (creating && password && password.length < 6) {
    const err = new Error('La contraseña debe tener al menos 6 caracteres');
    err.status = 400;
    throw err;
  }
  if (!creating && password && password.length < 6) {
    const err = new Error('La contraseña debe tener al menos 6 caracteres');
    err.status = 400;
    throw err;
  }
  let professionalId = body?.professionalId ? Number(body.professionalId) : null;
  let patientId = body?.patientId ? Number(body.patientId) : null;
  if (role !== 'profesional') professionalId = null;
  if (role !== 'paciente') patientId = null;
  if (role === 'profesional') {
    if (!professionalId) {
      const err = new Error('Elegí el profesional de este usuario');
      err.status = 400;
      throw err;
    }
    const found = await query('SELECT id FROM professionals WHERE id = $1', [professionalId]);
    if (!found.rowCount) {
      const err = new Error('Profesional no encontrado');
      err.status = 400;
      throw err;
    }
  }
  if (role === 'paciente') {
    if (!patientId) {
      const err = new Error('Elegí el paciente de este usuario');
      err.status = 400;
      throw err;
    }
    const found = await query('SELECT id FROM patients WHERE id = $1', [patientId]);
    if (!found.rowCount) {
      const err = new Error('Paciente no encontrado');
      err.status = 400;
      throw err;
    }
  }
  return {
    username,
    name,
    email: email || null,
    role,
    password: password || (creating ? crypto.randomBytes(18).toString('hex') : ''),
    sendPasswordLink: Boolean(body?.sendPasswordLink),
    sendPassword: Boolean(body?.sendPassword),
    professionalId,
    patientId,
    active: body?.active !== false,
    permissions: normalizePermissions(role, body?.permissions ?? current?.permissions),
    extra: extraObject(body?.extra ?? current?.extra),
  };
}

export default router;
