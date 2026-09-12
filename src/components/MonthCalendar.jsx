import { format, isSameDay, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { monthMatrix, ymd } from '../lib/calendar';

export default function MonthCalendar({ viewDate, events, tz, weekStartsOn = 1, onDayClick, onEventClick }) {
  const days = monthMatrix(viewDate, weekStartsOn);
  const today = new Date();
  const eventsByDay = {};
  for (const event of events) {
    const key = ymd(event.start, tz);
    eventsByDay[key] ||= [];
    eventsByDay[key].push(event);
  }

  return (
    <div className="flex h-full flex-col overflow-auto pb-24 lg:pb-0">
      <div className="grid grid-cols-7 border-b border-[#dadce0] text-center text-xs font-medium uppercase text-[#70757a]">
        {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
          .slice(weekStartsOn)
          .concat(['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].slice(0, weekStartsOn))
          .map((label, i) => (
            <div key={`${label}-${i}`} className="truncate py-1 text-[10px] sm:py-2 sm:text-xs">
              {label}
            </div>
          ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const key = ymd(day, tz);
          const dayEvents = eventsByDay[key] || [];
          const isToday = isSameDay(day, today);
          return (
            <button
              type="button"
              key={key}
              className="min-h-[72px] border-b border-r border-[#dadce0] p-0.5 text-left hover:bg-[#f8f9fa] sm:min-h-[110px] sm:p-1"
              onClick={() => onDayClick?.(day)}
            >
              <div
                className={`mb-1 ml-1 grid h-7 w-7 place-items-center rounded-full text-sm ${
                  isToday ? 'bg-[#1a73e8] text-white' : isSameMonth(day, viewDate) ? '' : 'text-[#bdc1c6]'
                }`}
              >
                {format(day, 'd', { locale: es })}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={`${event.tipo}-${event.id}`}
                    className="truncate rounded px-1 text-[11px]"
                    style={{ background: event.tipo === 'bloqueo' ? '#e8eaed' : event.color || '#1a73e8', color: event.tipo === 'bloqueo' ? '#3c4043' : '#fff' }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEventClick?.(event);
                    }}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="px-1 text-[11px] text-[#70757a]">+{dayEvents.length - 3} más</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
