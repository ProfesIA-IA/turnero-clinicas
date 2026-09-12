import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { from, to, professionalId } = req.query;
    const params = [];
    const where = [];
    if (from) {
      params.push(from);
      where.push(`ends_at > $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`starts_at < $${params.length}`);
    }
    if (professionalId) {
      params.push(professionalId);
      where.push(`(professional_id IS NULL OR professional_id = $${params.length})`);
    }
    const sql = `SELECT * FROM blocks ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY starts_at`;
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { professionalId = null, title = 'Bloqueo', startsAt, endsAt, reason } = req.body || {};
    if (!startsAt || !endsAt) return res.status(400).json({ error: 'Inicio y fin son obligatorios' });
    const result = await query(
      `INSERT INTO blocks (professional_id, title, starts_at, ends_at, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [professionalId, title, startsAt, endsAt, reason || null]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM blocks WHERE id = $1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Bloqueo no encontrado' });
    const prev = current.rows[0];
    const {
      professionalId = prev.professional_id,
      title = prev.title,
      startsAt = prev.starts_at,
      endsAt = prev.ends_at,
      reason = prev.reason,
    } = req.body || {};
    const result = await query(
      `UPDATE blocks
       SET professional_id = $1, title = $2, starts_at = $3, ends_at = $4, reason = $5
       WHERE id = $6
       RETURNING *`,
      [professionalId, title, startsAt, endsAt, reason, req.params.id]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM blocks WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
