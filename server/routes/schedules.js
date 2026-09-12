import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { professionalId } = req.query;
    const params = [];
    let sql = 'SELECT * FROM schedules';
    if (professionalId) {
      params.push(professionalId);
      sql += ` WHERE professional_id = $${params.length}`;
    }
    sql += ' ORDER BY professional_id, weekday, start_time';
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.put('/masivo/:professionalId', async (req, res, next) => {
  try {
    const professionalId = Number(req.params.professionalId);
    const windows = Array.isArray(req.body?.windows) ? req.body.windows : [];
    await query('DELETE FROM schedules WHERE professional_id = $1', [professionalId]);
    for (const window of windows) {
      if (window.weekday == null || !window.startTime || !window.endTime) continue;
      await query(
        `INSERT INTO schedules (professional_id, weekday, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
        [professionalId, window.weekday, window.startTime, window.endTime]
      );
    }
    const result = await query(
      'SELECT * FROM schedules WHERE professional_id = $1 ORDER BY weekday, start_time',
      [professionalId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { professionalId, weekday, startTime, endTime } = req.body || {};
    const result = await query(
      `INSERT INTO schedules (professional_id, weekday, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [professionalId, weekday, startTime, endTime]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM schedules WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
