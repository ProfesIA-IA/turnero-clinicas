import { Router } from 'express';
import { query } from '../db/pool.js';
import { availabilityForDay, getClinicSettings } from '../lib/availability.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { from, to, professionalIds } = req.query;
    const ids = String(professionalIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const params = [from, to];
    let appointmentSql = `
      SELECT
        a.id, a.starts_at, a.ends_at, a.status, a.notes, a.source,
        json_build_object('id', p.id, 'name', p.name, 'phone', p.phone, 'email', p.email) AS patient,
        json_build_object('id', pr.id, 'name', pr.name, 'color', pr.color) AS professional,
        json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'duration_min', s.duration_min) AS service
      FROM appointments a
      LEFT JOIN patients p ON p.id = a.patient_id
      JOIN professionals pr ON pr.id = a.professional_id
      JOIN services s ON s.id = a.service_id
      WHERE a.ends_at > $1 AND a.starts_at < $2 AND a.status <> 'CANCELADO'
    `;
    if (ids.length) {
      params.push(ids);
      appointmentSql += ` AND a.professional_id = ANY($${params.length}::int[])`;
    }
    appointmentSql += ' ORDER BY a.starts_at';

    const blockParams = [from, to];
    let blockSql = `
      SELECT b.*, json_build_object('id', pr.id, 'name', pr.name, 'color', pr.color) AS professional
      FROM blocks b
      LEFT JOIN professionals pr ON pr.id = b.professional_id
      WHERE b.ends_at > $1 AND b.starts_at < $2
    `;
    if (ids.length) {
      blockParams.push(ids);
      blockSql += ` AND (b.professional_id IS NULL OR b.professional_id = ANY($${blockParams.length}::int[]))`;
    }
    blockSql += ' ORDER BY b.starts_at';

    const [appointments, blocks, schedules] = await Promise.all([
      query(appointmentSql, params),
      query(blockSql, blockParams),
      query('SELECT * FROM schedules ORDER BY professional_id, weekday, start_time'),
    ]);

    res.json({
      data: {
        appointments: appointments.rows,
        blocks: blocks.rows,
        schedules: schedules.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/disponibilidad', async (req, res, next) => {
  try {
    const settings = await getClinicSettings();
    const result = await availabilityForDay({
      dateYmd: req.query.date,
      professionalId: req.query.professionalId,
      serviceId: req.query.serviceId,
      tz: settings.timezone,
      durationMin: req.query.durationMin ? Number(req.query.durationMin) : undefined,
      intervalMin: settings.slot_interval_min,
    });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
