import { query } from '../db/pool.js';

const ACTIVE_STATUSES = "('RESERVADO', 'CONFIRMADO')";

export async function hasAppointmentConflict({ professionalId, startsAt, endsAt, excludeId }) {
  const params = [professionalId, startsAt, endsAt];
  let sql = `
    SELECT id
    FROM appointments
    WHERE professional_id = $1
      AND status IN ${ACTIVE_STATUSES}
      AND starts_at < $3
      AND ends_at > $2
  `;
  if (excludeId) {
    params.push(excludeId);
    sql += ` AND id <> $${params.length}`;
  }
  sql += ' LIMIT 1';
  const result = await query(sql, params);
  return result.rows[0] || null;
}

export async function hasBlockConflict({ professionalId, startsAt, endsAt, excludeId }) {
  const params = [startsAt, endsAt, professionalId];
  let sql = `
    SELECT id
    FROM blocks
    WHERE starts_at < $2
      AND ends_at > $1
      AND (professional_id IS NULL OR professional_id = $3)
  `;
  if (excludeId) {
    params.push(excludeId);
    sql += ` AND id <> $${params.length}`;
  }
  sql += ' LIMIT 1';
  const result = await query(sql, params);
  return result.rows[0] || null;
}

export async function assertSlotFree(opts) {
  const appointment = await hasAppointmentConflict(opts);
  if (appointment) {
    const err = new Error('El profesional ya tiene un turno en ese horario');
    err.status = 409;
    throw err;
  }
  const block = await hasBlockConflict(opts);
  if (block) {
    const err = new Error('El horario está bloqueado');
    err.status = 409;
    throw err;
  }
}
