import { Router } from 'express';
import { query } from '../db/pool.js';
import { getClinicSettings } from '../lib/availability.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json({ data: await getClinicSettings() });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const current = await getClinicSettings();
    const {
      name = current.name,
      timezone = current.timezone,
      startHour = current.start_hour,
      endHour = current.end_hour,
      slotIntervalMin = current.slot_interval_min,
      weekStartsOn = current.week_starts_on,
    } = req.body || {};
    const result = await query(
      `UPDATE clinic_settings
       SET name = $1, timezone = $2, start_hour = $3, end_hour = $4,
           slot_interval_min = $5, week_starts_on = $6, updated_at = now()
       WHERE id = 1
       RETURNING *`,
      [name, timezone, startHour, endHour, slotIntervalMin, weekStartsOn]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
