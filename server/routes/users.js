import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { publicUser } from '../middleware/auth.js';
import { MODULES, ROLES, normalizePermissions, defaultsFor } from '../lib/permissions.js';

const router = Router();

const SELECT = `
  SELECT id, username, name, role, permissions, professional_id, patient_id, active, is_system, created_at
  FROM users
`;

router.get('/meta', (_req, res) => {
  res.json({
    modules: MODULES,
    roles: ROLES,
    defaults: {
      secretaria: defaultsFor('secretaria'),
      profesional: defaultsFor('profesional'),
      paciente: defaultsFor('paciente'),
    },
  });
});

router.get('/', async (_req, res, next) => {
  try {
    const result = await query(`${SELECT} ORDER BY is_system DESC, name ASC`);
    res.json({ data: result.rows.map(publicUserRow) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = await validateBody(req.body, { creating: true });
    const hash = await bcrypt.hash(body.password, 10);
    const result = await query(
      `INSERT INTO users (username, password_hash, name, role, permissions, professional_id, patient_id, active, is_system)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, false)
       RETURNING id, username, name, role, permissions, professional_id, patient_id, active, is_system, created_at`,
      [
        body.username,
        hash,
        body.name,
        body.role,
        JSON.stringify(body.permissions),
        body.professionalId,
        body.patientId,
        body.active,
      ]
    );
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
      body.role,
      JSON.stringify(body.permissions),
      body.professionalId,
      body.patientId,
      body.active,
      current.id,
    ];
    let sql = `
      UPDATE users
      SET username = $1, name = $2, role = $3, permissions = $4::jsonb,
          professional_id = $5, patient_id = $6, active = $7
      WHERE id = $8
    `;
    if (body.password) {
      const hash = await bcrypt.hash(body.password, 10);
      sql = `
        UPDATE users
        SET username = $1, name = $2, role = $3, permissions = $4::jsonb,
            professional_id = $5, patient_id = $6, active = $7, password_hash = $9
        WHERE id = $8
      `;
      params.push(hash);
    }
    const result = await query(
      `${sql} RETURNING id, username, name, role, permissions, professional_id, patient_id, active, is_system, created_at`,
      params
    );
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
  if (creating && password.length < 6) {
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
    role,
    password,
    professionalId,
    patientId,
    active: body?.active !== false,
    permissions: normalizePermissions(role, body?.permissions ?? current?.permissions),
  };
}

export default router;
