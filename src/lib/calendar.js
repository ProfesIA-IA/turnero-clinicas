import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

export const WEEKDAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WEEKDAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function clinicDate(date, tz) {
  return toZonedTime(date, tz);
}

export function ymd(date, tz) {
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

export function minutesOf(date, tz) {
  const local = toZonedTime(date, tz);
  return local.getHours() * 60 + local.getMinutes();
}

export function atMinutes(dateYmd, minutes, tz) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return fromZonedTime(`${dateYmd}T${h}:${m}:00`, tz);
}

export function formatTime(date, tz) {
  return formatInTimeZone(date, tz, 'H:mm');
}

export function formatRangeLabel(start, end, tz) {
  return `${formatTime(start, tz)} – ${formatTime(end, tz)}`;
}

export function visibleWeek(viewDate, weekStartsOn) {
  const start = startOfWeek(viewDate, { weekStartsOn });
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

export function monthMatrix(viewDate, weekStartsOn) {
  const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn });
  const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn });
  return eachDayOfInterval({ start, end });
}

export function monthTitle(viewDate) {
  const raw = format(viewDate, 'MMMM yyyy', { locale: es });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function layoutOverlaps(events) {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const clusters = [];
  let current = [];
  let clusterEnd = -1;
  for (const event of sorted) {
    if (!current.length || event.startMin < clusterEnd) {
      current.push(event);
      clusterEnd = Math.max(clusterEnd, event.endMin);
    } else {
      clusters.push(current);
      current = [event];
      clusterEnd = event.endMin;
    }
  }
  if (current.length) clusters.push(current);

  const positioned = [];
  for (const cluster of clusters) {
    const columns = [];
    for (const event of cluster) {
      let col = columns.findIndex((end) => end <= event.startMin);
      if (col === -1) {
        col = columns.length;
        columns.push(event.endMin);
      } else {
        columns[col] = event.endMin;
      }
      positioned.push({ ...event, _col: col, _cols: 0 });
    }
    const cols = columns.length;
    for (const item of positioned.slice(-cluster.length)) {
      item._cols = cols;
    }
  }
  return positioned;
}

export function hexToRgba(hex, alpha) {
  const clean = String(hex || '#1a73e8').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function addMonthsSafe(date, amount) {
  return addMonths(date, amount);
}

export function shareUrl(kind, slug) {
  const path = kind === 'servicio' ? `/reservar/servicio/${slug}` : `/reservar/profesional/${slug}`;
  return `${window.location.origin}${path}`;
}
