import { Router } from 'express';
import { query } from '../db/pool.js';
import { recordScope } from '../lib/permissions.js';
import { extraObject } from '../lib/extra.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const params = [];
    let sql = 'SELECT * FROM patients';
    const where = [];
    const scope = recordScope(req.user);
    if (scope?.patientId != null) {
      params.push(scope.patientId);
      where.push(`id = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`name ILIKE $${params.length}`);
    }
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    params.push(limit);
    sql += ` ORDER BY name ASC LIMIT $${params.length}`;
    const result = await query(sql, params);
    res.json({ data: result.rows });
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
    const { name, phone, email, notes, extra } = req.body || {};
    if (!String(name || '').trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const result = await query(
      `INSERT INTO patients (name, phone, email, notes, extra)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING *`,
      [name.trim(), emptyToNull(phone), emptyToNull(email), emptyToNull(notes), JSON.stringify(extraObject(extra))]
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
    const { name = prev.name, phone = prev.phone, email = prev.email, notes = prev.notes, extra = prev.extra } = req.body || {};
    if (!String(name || '').trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const result = await query(
      `UPDATE patients
       SET name = $1, phone = $2, email = $3, notes = $4, extra = $5::jsonb
       WHERE id = $6
       RETURNING *`,
      [name.trim(), emptyToNull(phone), emptyToNull(email), emptyToNull(notes), JSON.stringify(extraObject(extra)), req.params.id]
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
