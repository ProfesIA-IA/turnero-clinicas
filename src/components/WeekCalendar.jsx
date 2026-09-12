import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo, useRef } from 'react';
import {
  formatTime,
  hexToRgba,
  layoutOverlaps,
  minutesOf,
  visibleWeek,
  ymd,
} from '../lib/calendar';

export default function WeekCalendar({
  viewDate,
  days: daysProp,
  events,
  tz,
  startHour = 8,
  endHour = 21,
  hourHeight = 48,
  slotIntervalMin = 30,
  weekStartsOn = 1,
  hideWeekends = false,
  availability = [],
  onCellClick,
  onEventClick,
  onEventDrop,
}) {
  const days = (daysProp || visibleWeek(viewDate, weekStartsOn)).filter((day) => {
    if (!hideWeekends) return true;
    const dow = day.getDay();
    return dow !== 0 && dow !== 6;
  });
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridStart = startHour * 60;
  const gridEnd = endHour * 60;
  const pxPerMin = hourHeight / 60;
  const today = new Date();
  const nowMin = minutesOf(today, tz);
  const showNow = days.some((day) => isSameDay(day, today)) && nowMin >= gridStart && nowMin <= gridEnd;

  const eventsByDay = useMemo(() => {
    const map = {};
    for (const day of days) map[ymd(day, tz)] = [];
    for (const event of events) {
      const key = ymd(event.start, tz);
      if (!map[key]) continue;
      const startMin = minutesOf(event.start, tz);
      const endMin = minutesOf(event.end, tz);
      map[key].push({
        ...event,
        startMin,
        endMin,
        _topPx: (startMin - gridStart) * pxPerMin,
        _heightPx: Math.max(18, (endMin - startMin) * pxPerMin - 2),
      });
    }
    for (const key of Object.keys(map)) {
      map[key] = layoutOverlaps(map[key]);
    }
    return map;
  }, [days, events, tz, gridStart, pxPerMin]);

  const drag = useRef(null);

  function handlePointerDown(event, calEvent) {
    if (!onEventDrop || calEvent.tipo === 'bloqueo') return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      event: calEvent,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
    };
  }

  function handlePointerUp(event, day, calEvent) {
    const state = drag.current;
    drag.current = null;
    if (!state || state.event.id !== calEvent.id) {
      onEventClick?.(calEvent);
      return;
    }
    const dx = Math.abs(event.clientX - state.originX);
    const dy = Math.abs(event.clientY - state.originY);
    if (dx < 6 && dy < 6) {
      onEventClick?.(calEvent);
      return;
    }
    const column = event.currentTarget.closest('[data-day]');
    if (!column) return;
    const rect = column.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    let startMin = gridStart + offsetY / pxPerMin;
    startMin = Math.round(startMin / slotIntervalMin) * slotIntervalMin;
    const duration = minutesOf(calEvent.end, tz) - minutesOf(calEvent.start, tz);
    onEventDrop?.({
      event: calEvent,
      dayKey: column.getAttribute('data-day'),
      startMin,
      endMin: startMin + duration,
    });
  }

  return (
    <div className="week-scroll">
      <div className="week-grid" style={{ '--days': days.length, '--hour-h': `${hourHeight}px` }}>
        <div className="week-gutter-head">
          <div className="hour-label">{formatHour(startHour)}</div>
        </div>
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} className="week-day-head">
              <div className="week-day-name">
                {format(day, 'EEE', { locale: es }).replace('.', '')}
              </div>
              <div className={`day-num ${isToday ? 'is-today' : ''}`}>{format(day, 'd')}</div>
            </div>
          );
        })}
        <div className="week-gutter">
          {hours.map((hour) => (
            <div key={hour} className="hour-row">
              {hour !== startHour && <div className="hour-label">{formatHour(hour)}</div>}
            </div>
          ))}
        </div>
        {days.map((day) => {
          const key = ymd(day, tz);
          const dayEvents = eventsByDay[key] || [];
          const isToday = isSameDay(day, today);
          const bands = availability.filter((block) => block.dayKey === key);
          return (
            <div
              key={key}
              className="day-col"
              data-day={key}
              style={{ height: hours.length * hourHeight }}
            >
              {hours.map((hour) => (
                <div key={hour} className="hour-row" />
              ))}
              {Array.from({ length: ((endHour - startHour) * 60) / slotIntervalMin }, (_, i) => {
                const startMin = gridStart + i * slotIntervalMin;
                return (
                  <div
                    key={startMin}
                    className="slot-hit"
                    style={{ top: (startMin - gridStart) * pxPerMin, height: slotIntervalMin * pxPerMin }}
                    onClick={() => onCellClick?.({ day, startMin, dateYmd: key })}
                  />
                );
              })}
              {bands.map((band) => (
                <div
                  key={`${band.startMin}-${band.endMin}`}
                  className="avail-band"
                  style={{
                    top: (band.startMin - gridStart) * pxPerMin,
                    height: (band.endMin - band.startMin) * pxPerMin,
                  }}
                />
              ))}
              {isToday && showNow && (
                <div className="now-line" style={{ top: (nowMin - gridStart) * pxPerMin }}>
                  <span className="now-dot" />
                </div>
              )}
              {dayEvents.map((event) => {
                const width = `calc((100% - 8px) / ${event._cols})`;
                const left = `calc(4px + ((100% - 8px) / ${event._cols}) * ${event._col})`;
                const color = event.color || '#1a73e8';
                const isBlock = event.tipo === 'bloqueo';
                return (
                  <div
                    key={`${event.tipo}-${event.id}`}
                    className={`event-chip ${isBlock ? 'bloqueo' : ''}`}
                    style={{
                      top: event._topPx,
                      height: event._heightPx,
                      width,
                      left,
                      right: 'auto',
                      background: isBlock ? '#e8eaed' : hexToRgba(color, 0.22),
                      color: isBlock ? '#3c4043' : shade(color),
                      borderColor: isBlock ? '#dadce0' : hexToRgba(color, 0.4),
                    }}
                    onPointerDown={(ev) => handlePointerDown(ev, event)}
                    onPointerUp={(ev) => handlePointerUp(ev, day, event)}
                    title={event.title}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="opacity-80 truncate">{formatTime(event.start, tz)}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatHour(hour) {
  return `${hour}:00`;
}

function shade(hex) {
  return hex || '#174ea6';
}
