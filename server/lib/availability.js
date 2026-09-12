import { query } from '../db/pool.js';
import {
  dayBounds,
  minutesFromZoned,
  minutesToTime,
  timeToMinutes,
  weekdayInTz,
  ymdInTz,
  zonedDateTime,
} from './time.js';
import { generateSlots } from './slots.js';

export async function getClinicSettings() {
  const result = await query('SELECT * FROM clinic_settings WHERE id = 1');
  return result.rows[0];
}

export async function listBusyMinutes({ professionalId, start, end, tz, excludeAppointmentId }) {
  const params = [professionalId, start, end];
  let sql = `
    SELECT starts_at, ends_at
    FROM appointments
    WHERE professional_id = $1
      AND status IN ('RESERVADO', 'CONFIRMADO')
      AND starts_at < $3
      AND ends_at > $2
  `;
  if (excludeAppointmentId) {
    params.push(excludeAppointmentId);
    sql += ` AND id <> $${params.length}`;
  }

  const appointments = await query(sql, params);
  const blocks = await query(
    `
      SELECT starts_at, ends_at
      FROM blocks
      WHERE starts_at < $2
        AND ends_at > $1
        AND (professional_id IS NULL OR professional_id = $3)
    `,
    [start, end, professionalId]
  );

  return [...appointments.rows, ...blocks.rows].map((row) => ({
    startMin: minutesFromZoned(row.starts_at, tz),
    endMin: minutesFromZoned(row.ends_at, tz),
  }));
}

export async function windowsForProfessional(professionalId, weekday) {
  const result = await query(
    `
      SELECT start_time, end_time
      FROM schedules
      WHERE professional_id = $1 AND weekday = $2
      ORDER BY start_time
    `,
    [professionalId, weekday]
  );
  return result.rows.map((row) => ({
    startMin: timeToMinutes(row.start_time),
    endMin: timeToMinutes(row.end_time),
  }));
}

export async function availabilityForDay({
  dateYmd,
  professionalId,
  serviceId,
  tz,
  durationMin,
  intervalMin,
  now = new Date(),
}) {
  const settings = await getClinicSettings();
  const timezone = tz || settings.timezone;
  const duration = durationMin || 30;
  const interval = intervalMin || settings.slot_interval_min || duration;
  const weekday = weekdayInTz(dateYmd, timezone);
  const { start, end } = dayBounds(dateYmd, timezone);
  const todayYmd = ymdInTz(now, timezone);
  const earliestMin = dateYmd === todayYmd ? minutesFromZoned(now, timezone) : 0;

  let professionalIds = [];
  if (professionalId) {
    professionalIds = [Number(professionalId)];
  } else if (serviceId) {
    const linked = await query(
      `
        SELECT p.id
        FROM professionals p
        JOIN professional_services ps ON ps.professional_id = p.id
        WHERE ps.service_id = $1 AND p.active = true
        ORDER BY p.name
      `,
      [serviceId]
    );
    professionalIds = linked.rows.map((row) => row.id);
  }

  const slots = [];
  for (const id of professionalIds) {
    const windows = await windowsForProfessional(id, weekday);
    if (!windows.length) continue;
    const busy = await listBusyMinutes({ professionalId: id, start, end, tz: timezone });
    const generated = generateSlots({
      windows,
      busy,
      durationMin: duration,
      intervalMin: interval,
      earliestMin,
    });
    const professional = await query('SELECT id, name, color FROM professionals WHERE id = $1', [id]);
    for (const slot of generated) {
      slots.push({
        professionalId: id,
        professionalName: professional.rows[0]?.name,
        professionalColor: professional.rows[0]?.color,
        startMin: slot.startMin,
        endMin: slot.endMin,
        start: zonedDateTime(dateYmd, slot.startMin, timezone).toISOString(),
        end: zonedDateTime(dateYmd, slot.endMin, timezone).toISOString(),
        label: minutesToTime(slot.startMin),
      });
    }
  }

  slots.sort((a, b) => a.startMin - b.startMin || a.professionalName.localeCompare(b.professionalName));
  return { date: dateYmd, timezone, durationMin: duration, slots };
}
