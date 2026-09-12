import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';

export function timeToMinutes(value) {
  if (value == null) return 0;
  const text = String(value);
  const [h, m] = text.split(':');
  return Number(h) * 60 + Number(m || 0);
}

export function minutesToTime(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function ymdInTz(date, tz) {
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

export function addYmd(dateYmd, days) {
  const [year, month, day] = dateYmd.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function dayBounds(dateYmd, tz) {
  const start = fromZonedTime(`${dateYmd}T00:00:00`, tz);
  const end = fromZonedTime(`${addYmd(dateYmd, 1)}T00:00:00`, tz);
  return { start, end };
}

export function weekdayInTz(dateYmd, tz) {
  const local = toZonedTime(fromZonedTime(`${dateYmd}T12:00:00`, tz), tz);
  return local.getDay();
}

export function zonedDateTime(dateYmd, minutes, tz) {
  return fromZonedTime(`${dateYmd}T${minutesToTime(minutes)}:00`, tz);
}

export function minutesFromZoned(date, tz) {
  const local = toZonedTime(date, tz);
  return local.getHours() * 60 + local.getMinutes();
}

export function formatYmd(date) {
  return format(date, 'yyyy-MM-dd');
}
