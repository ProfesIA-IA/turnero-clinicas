import { Router } from 'express';
import { query } from '../db/pool.js';
import { recordScope } from '../lib/permissions.js';
import { extraObject } from '../lib/extra.js';
import { likeTerm, pageRequest } from '../lib/paging.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const paging = pageRequest(req.query);
    const limit = paging?.limit ?? Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const params = [];
    const where = [];
    const scope = recordScope(req.user);
    if (scope?.patientId != null) {
      params.push(scope.patientId);
      where.push(`id = $${params.length}`);
    }
    if (q) {
      params.push(likeTerm(q));
      const n = params.length;
      where.push(`(name ILIKE $${n} OR phone ILIKE $${n} OR email ILIKE $${n} OR dni ILIKE $${n})`);
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const count = await query(`SELECT count(*)::int AS total FROM patients${whereSql}`, params);
    const listParams = [...params];
    listParams.push(limit);
    let sql = `SELECT * FROM patients${whereSql} ORDER BY name ASC LIMIT $${listParams.length}`;
    if (paging) {
      listParams.push(paging.offset);
      sql += ` OFFSET $${listParams.length}`;
    }
    const result = await query(sql, listParams);
    res.json({ data: result.rows, total: count.rows[0].total, page: paging?.page || 1, limit });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const scope = recordScope(req.user);
    if (scope?.patientId != null && Number(req.params.id) !== scope.patientId) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    const result = await query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Paciente no encontrado' });
    const appointments = await query(
      `
        SELECT a.id, a.starts_at, a.ends_at, a.status,
               json_build_object('id', pr.id, 'name', pr.name) AS professional,
               json_build_object('id', s.id, 'name', s.name) AS service
        FROM appointments a
        JOIN professionals pr ON pr.id = a.professional_id
        JOIN services s ON s.id = a.service_id
        WHERE a.patient_id = $1
        ORDER BY a.starts_at DESC
        LIMIT 100
      `,
      [req.params.id]
    );
    res.json({ data: { ...result.rows[0], appointments: appointments.rows } });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, phone, email, dni, notes, extra } = req.body || {};
    if (!String(name || '').trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const result = await query(
      `INSERT INTO patients (name, phone, email, dni, notes, extra)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING *`,
      [name.trim(), emptyToNull(phone), emptyToNull(email), emptyToNull(dni), emptyToNull(notes), JSON.stringify(extraObject(extra))]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Paciente no encontrado' });
    const prev = current.rows[0];
    const { name = prev.name, phone = prev.phone, email = prev.email, dni = prev.dni, notes = prev.notes, extra = prev.extra } = req.body || {};
    if (!String(name || '').trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const result = await query(
      `UPDATE patients
       SET name = $1, phone = $2, email = $3, dni = $4, notes = $5, extra = $6::jsonb
       WHERE id = $7
       RETURNING *`,
      [name.trim(), emptyToNull(phone), emptyToNull(email), emptyToNull(dni), emptyToNull(notes), JSON.stringify(extraObject(extra)), req.params.id]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM patients WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

function emptyToNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

export default router;
