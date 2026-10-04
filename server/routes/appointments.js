import { Router } from 'express';
import { query } from '../db/pool.js';
import { assertSlotFree } from '../lib/conflicts.js';
import { notifyUsersOfAppointment, sendAppointmentEmail } from '../lib/mail.js';
import { recordScope } from '../lib/permissions.js';
import { likeTerm, pageRequest } from '../lib/paging.js';

const router = Router();

const APPOINTMENT_SELECT = `
  SELECT
    a.*,
    json_build_object('id', p.id, 'name', p.name, 'phone', p.phone, 'email', p.email, 'dni', p.dni) AS patient,
    json_build_object('id', pr.id, 'name', pr.name, 'color', pr.color, 'share_slug', pr.share_slug) AS professional,
    json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'duration_min', s.duration_min) AS service
  FROM appointments a
  LEFT JOIN patients p ON p.id = a.patient_id
  JOIN professionals pr ON pr.id = a.professional_id
  JOIN services s ON s.id = a.service_id
`;

export async function upsertPatient({ name, dni, phone, email, notes }) {
  const cleanDni = String(dni || '').trim();
  if (cleanDni) {
    const byDni = await query('SELECT * FROM patients WHERE dni = $1', [cleanDni]);
    if (byDni.rowCount) {
      const prev = byDni.rows[0];
      const result = await query(
        `UPDATE patients SET name = $1, phone = COALESCE($2, phone), email = COALESCE($3, email), notes = COALESCE($4, notes)
         WHERE id = $5 RETURNING *`,
        [name || prev.name, phone || null, email || null, notes || null, prev.id]
      );
      return result.rows[0];
    }
  }
  if (phone) {
    const existing = await query('SELECT * FROM patients WHERE phone = $1', [phone]);
    if (existing.rowCount) {
      const prev = existing.rows[0];
      const result = await query(
        `UPDATE patients SET name = $1, dni = COALESCE($2, dni), email = COALESCE($3, email), notes = COALESCE($4, notes)
         WHERE id = $5 RETURNING *`,
        [name || prev.name, cleanDni || null, email || null, notes || null, prev.id]
      );
      return result.rows[0];
    }
  }
  const result = await query(
    'INSERT INTO patients (name, phone, email, dni, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name || 'Paciente', phone || null, email || null, cleanDni || null, notes || null]
  );
  return result.rows[0];
}

function visibleAppointment(user, row) {
  const scope = recordScope(user);
  if (!scope) return true;
  if (scope.patientId != null && Number(row.patient_id) !== scope.patientId) return false;
  if (scope.professionalId != null && Number(row.professional_id) !== scope.professionalId) return false;
  return true;
}

async function getAppointment(id) {
  const result = await query(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [id]);
  return result.rows[0] || null;
}

router.get('/', async (req, res, next) => {
  try {
    const { from, to, professionalId, serviceId, status } = req.query;
    const q = String(req.query.q || '').trim();
    const paging = pageRequest(req.query);
    const params = [];
    const where = [];
    if (from) {
      params.push(from);
      where.push(`a.ends_at > $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`a.starts_at < $${params.length}`);
    }
    if (professionalId) {
      params.push(professionalId);
      where.push(`a.professional_id = $${params.length}`);
    }
    if (serviceId) {
      params.push(serviceId);
      where.push(`a.service_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`a.status = $${params.length}`);
    }
    if (q) {
      params.push(likeTerm(q));
      const n = params.length;
      where.push(`(p.name ILIKE $${n} OR pr.name ILIKE $${n} OR s.name ILIKE $${n})`);
    }
    const scope = recordScope(req.user);
    if (scope?.patientId != null) {
      params.push(scope.patientId);
      where.push(`a.patient_id = $${params.length}`);
    }
    if (scope?.professionalId != null) {
      params.push(scope.professionalId);
      where.push(`a.professional_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await query(
      `SELECT count(*)::int AS total FROM appointments a
       LEFT JOIN patients p ON p.id = a.patient_id
       JOIN professionals pr ON pr.id = a.professional_id
       JOIN services s ON s.id = a.service_id
       ${whereSql}`,
      params
    );
    let sql = `${APPOINTMENT_SELECT} ${whereSql} ORDER BY a.starts_at DESC`;
    if (paging) {
      params.push(paging.limit, paging.offset);
      sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }
    const result = await query(sql, params);
    res.json({
      data: result.rows,
      total: count.rows[0].total,
      page: paging?.page || 1,
      limit: paging?.limit || count.rows[0].total,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await getAppointment(req.params.id);
    if (!row || !visibleAppointment(req.user, row)) return res.status(404).json({ error: 'Turno no encontrado' });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const created = await createAppointment(req.body || {}, 'staff');
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!current.rowCount || !visibleAppointment(req.user, current.rows[0])) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    const prev = current.rows[0];
    const {
      professionalId = prev.professional_id,
      serviceId = prev.service_id,
      startsAt = prev.starts_at,
      endsAt = prev.ends_at,
      status = prev.status,
      notes = prev.notes,
      patient,
      patientId: bodyPatientId,
    } = req.body || {};

    let patientId = prev.patient_id;
    if (bodyPatientId) {
      patientId = bodyPatientId;
    } else if (patient?.name || patient?.phone) {
      const saved = await upsertPatient(patient);
      patientId = saved.id;
    }

    await assertSlotFree({
      professionalId,
      startsAt,
      endsAt,
      excludeId: Number(req.params.id),
    });

    await query(
      `UPDATE appointments
       SET patient_id = $1, professional_id = $2, service_id = $3, starts_at = $4, ends_at = $5,
           status = $6, notes = $7, updated_at = now()
       WHERE id = $8`,
      [patientId, professionalId, serviceId, startsAt, endsAt, status, notes, req.params.id]
    );
    res.json({ data: await getAppointment(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/cancelar', async (req, res, next) => {
  try {
    const current = await getAppointment(req.params.id);
    if (!current || !visibleAppointment(req.user, current)) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    await query(
      `UPDATE appointments SET status = 'CANCELADO', updated_at = now() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ data: await getAppointment(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const current = await getAppointment(req.params.id);
    if (!current || !visibleAppointment(req.user, current)) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    await query('DELETE FROM appointments WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export async function createAppointment(body, source = 'staff') {
  const {
    professionalId,
    serviceId,
    startsAt,
    endsAt,
    status = 'RESERVADO',
    notes,
    patient,
  } = body;
  if (!professionalId || !serviceId || !startsAt) {
    const err = new Error('Profesional, servicio e inicio son obligatorios');
    err.status = 400;
    throw err;
  }

  const service = await query('SELECT * FROM services WHERE id = $1', [serviceId]);
  if (!service.rowCount) {
    const err = new Error('Servicio no encontrado');
    err.status = 404;
    throw err;
  }

  const start = new Date(startsAt);
  const end = endsAt
    ? new Date(endsAt)
    : new Date(start.getTime() + service.rows[0].duration_min * 60 * 1000);

  await assertSlotFree({ professionalId, startsAt: start, endsAt: end });

  let patientId = body.patientId || null;
  if (!patientId && (patient?.name || patient?.phone)) {
    const saved = await upsertPatient(patient);
    patientId = saved.id;
  }

  const result = await query(
    `INSERT INTO appointments
      (patient_id, professional_id, service_id, starts_at, ends_at, status, notes, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [patientId, professionalId, serviceId, start, end, status, notes || null, source]
  );
  const created = await getAppointment(result.rows[0].id);
  try {
    await sendAppointmentEmail(created);
    await notifyUsersOfAppointment(created);
  } catch (err) {
    console.error('Email de turno no enviado:', err.message);
  }
  return created;
}

export default router;
