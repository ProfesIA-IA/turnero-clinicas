import { format, isSameDay, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthMatrix, monthTitle, WEEKDAYS_SHORT } from '../lib/calendar';

export default function MiniCalendar({ value, onChange, weekStartsOn = 1, cursor, onCursorChange }) {
  const view = cursor || value;
  const days = monthMatrix(view, weekStartsOn);
  const today = new Date();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">{monthTitle(view)}</div>
        <div className="flex">
          <button className="icon-btn" type="button" onClick={() => onCursorChange?.(addMonthsLocal(view, -1))} aria-label="Mes anterior">
            <ChevronLeft size={16} />
          </button>
          <button className="icon-btn" type="button" onClick={() => onCursorChange?.(addMonthsLocal(view, 1))} aria-label="Mes siguiente">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="mini-dow">
        {rotated(WEEKDAYS_SHORT, weekStartsOn).map((d, i) => (
          <div key={`${d}-${i}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const selected = isSameDay(day, value);
          const isToday = isSameDay(day, today);
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={`mini-day ${isToday ? 'today' : ''} ${selected ? 'selected' : ''} ${
                isSameMonth(day, view) ? '' : 'outside'
              }`}
              onClick={() => onChange(day)}
            >
              {format(day, 'd', { locale: es })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function rotated(list, start) {
  return [...list.slice(start), ...list.slice(0, start)];
}

function addMonthsLocal(date, amount) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}
