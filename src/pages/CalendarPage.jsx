import { useEffect, useState } from 'react';
import { addDays, addMonths } from 'date-fns';
import { CalendarPlus, ChevronLeft, ChevronRight, ExternalLink, Plus } from 'lucide-react';
import MiniCalendar from '../components/MiniCalendar';
import WeekCalendar from '../components/WeekCalendar';
import MonthCalendar from '../components/MonthCalendar';
import AppointmentModal from '../components/AppointmentModal';
import BlockModal from '../components/BlockModal';
import { api } from '../api';
import { useClinic } from '../clinic';
import { atMinutes, monthTitle, shareUrl, ymd } from '../lib/calendar';

const STATUSES = [
  { id: 'RESERVADO', label: 'Reservado', color: '#1a73e8' },
  { id: 'CONFIRMADO', label: 'Confirmado', color: '#0b8043' },
  { id: 'COMPLETADO', label: 'Completado', color: '#5f6368' },
  { id: 'CANCELADO', label: 'Cancelado', color: '#d93025' },
];

export default function CalendarPage() {
  const { settings, professionals, services, viewDate, setViewDate, enabledIds, setEnabledIds, tz } = useClinic();
  const [mode, setMode] = useState(() => (window.matchMedia('(max-width: 1023px)').matches ? 'day' : 'week'));
  const [menuOpen, setMenuOpen] = useState(false);
  const [agenda, setAgenda] = useState({ appointments: [], blocks: [], schedules: [] });
  const [turno, setTurno] = useState(null);
  const [bloqueo, setBloqueo] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [blockDefaults, setBlockDefaults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState(STATUSES.map((item) => item.id));

  const startHour = settings?.start_hour ?? 8;
  const endHour = settings?.end_hour ?? 21;
  const weekStartsOn = settings?.week_starts_on ?? 1;
  const slotIntervalMin = settings?.slot_interval_min ?? 30;

  useEffect(() => {
    if (!enabledIds.length) {
      setAgenda({ appointments: [], blocks: [], schedules: [] });
      return;
    }
    const { from, to } = rangeFor(viewDate, mode, weekStartsOn);
    const ids = enabledIds.join(',');
    api
      .agenda(`?from=${from.toISOString()}&to=${to.toISOString()}&professionalIds=${ids}`)
      .then((res) => setAgenda(res.data))
      .catch(() => {});
  }, [viewDate, mode, enabledIds, weekStartsOn]);

  const events = [
    ...agenda.appointments.filter((item) => statuses.includes(item.status)).map((item) => ({
      id: item.id,
      tipo: 'turno',
      title: `${item.patient?.name || 'Turno'} · ${item.service?.name || ''}`.trim(),
      start: new Date(item.starts_at),
      end: new Date(item.ends_at),
      color: item.professional?.color || item.service?.color,
      raw: item,
    })),
    ...agenda.blocks.map((item) => ({
      id: item.id,
      tipo: 'bloqueo',
      title: item.title || 'Bloqueo',
      start: new Date(item.starts_at),
      end: new Date(item.ends_at),
      color: '#9aa0a6',
      raw: item,
    })),
  ];

  const availability = [];
  const weekStart = startOfView(viewDate, weekStartsOn);
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const day = addDays(weekStart, dayOffset);
    const weekday = day.getDay();
    const dayKey = ymd(day, tz);
    for (const schedule of agenda.schedules || []) {
      if (!enabledIds.includes(schedule.professional_id)) continue;
      if (Number(schedule.weekday) !== weekday) continue;
      availability.push({
        dayKey,
        startMin: toMin(schedule.start_time),
        endMin: toMin(schedule.end_time),
      });
    }
  }

  async function refresh() {
    const { from, to } = rangeFor(viewDate, mode, weekStartsOn);
    const res = await api.agenda(
      `?from=${from.toISOString()}&to=${to.toISOString()}&professionalIds=${enabledIds.join(',')}`
    );
    setAgenda(res.data);
  }

  function openCreate(startMin, dateYmd) {
    const hh = String(Math.floor(startMin / 60)).padStart(2, '0');
    const mm = String(startMin % 60).padStart(2, '0');
    setDefaults({
      date: dateYmd,
      time: `${hh}:${mm}`,
      professionalId: enabledIds[0],
      serviceId: services[0]?.id,
    });
    setTurno('new');
    setMenuOpen(false);
  }

  function openEvent(event) {
    if (event.tipo === 'bloqueo') setBloqueo(event.raw);
    else setTurno(event.raw);
  }

  function shift(dir) {
    if (mode === 'month') setViewDate(addMonths(viewDate, dir));
    else if (mode === 'day') setViewDate(addDays(viewDate, dir));
    else setViewDate(addDays(viewDate, dir * 7));
  }

  const sidebar = (
    <>
      <div className="relative mb-5 hidden lg:block">
        <button className="create-btn" type="button" onClick={() => setMenuOpen((v) => !v)}>
          <Plus size={22} className="text-[#1a73e8]" />
          Crear
        </button>
        {menuOpen && (
          <CreateMenu
            onTurno={() => openCreate(9 * 60, ymd(viewDate, tz))}
            onBloqueo={() => {
              setBlockDefaults({ date: ymd(viewDate, tz) });
              setBloqueo('new');
              setMenuOpen(false);
            }}
          />
        )}
      </div>
      <MiniCalendar
        value={viewDate}
        onChange={(day) => {
          setViewDate(day);
        }}
        weekStartsOn={weekStartsOn}
        cursor={viewDate}
        onCursorChange={setViewDate}
      />
      <div className="mt-6">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#70757a]">Páginas de reserva</div>
        {professionals
          .filter((p) => p.share_enabled && p.share_slug)
          .map((pro) => (
            <ShareLink key={pro.id} href={shareUrl('profesional', pro.share_slug)} label={pro.name} />
          ))}
        {services
          .filter((s) => s.share_enabled && s.share_slug)
          .map((service) => (
            <ShareLink key={`s-${service.id}`} href={shareUrl('servicio', service.share_slug)} label={service.name} />
          ))}
      </div>
      <div className="mt-6">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#70757a]">Estado</div>
        {STATUSES.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-sm">
            <input
              type="checkbox"
              checked={statuses.includes(item.id)}
              onChange={(e) => {
                setStatuses((prev) => (e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)));
              }}
            />
            <span className="h-3 w-3 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </label>
        ))}
      </div>
      <div className="mt-6">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#70757a]">Mis calendarios</div>
        {professionals.map((pro) => (
          <label key={pro.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-sm">
            <input
              type="checkbox"
              checked={enabledIds.includes(pro.id)}
              onChange={(e) => {
                setEnabledIds((prev) =>
                  e.target.checked ? [...prev, pro.id] : prev.filter((id) => id !== pro.id)
                );
              }}
            />
            <span className="h-3 w-3 rounded-sm" style={{ background: pro.color }} />
            {pro.name}
          </label>
        ))}
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="hidden w-[280px] shrink-0 overflow-auto p-4 lg:block">{sidebar}</div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="cal-toolbar">
          <button className="pill-btn shrink-0" type="button" onClick={() => setViewDate(new Date())}>
            Hoy
          </button>
          <button className="icon-btn shrink-0" type="button" onClick={() => shift(-1)} aria-label="Anterior">
            <ChevronLeft size={20} />
          </button>
          <button className="icon-btn shrink-0" type="button" onClick={() => shift(1)} aria-label="Siguiente">
            <ChevronRight size={20} />
          </button>
          <h1 className="min-w-0 flex-1 truncate px-1 text-base font-normal sm:px-2 sm:text-xl">
            {monthTitle(viewDate)}
          </h1>
          <select
            className="pill-btn shrink-0"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            aria-label="Vista"
          >
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </div>
        {mode === 'month' ? (
          <MonthCalendar
            viewDate={viewDate}
            events={events}
            tz={tz}
            weekStartsOn={weekStartsOn}
            onDayClick={(day) => {
              setViewDate(day);
              setMode('day');
            }}
            onEventClick={openEvent}
          />
        ) : (
          <WeekCalendar
            viewDate={viewDate}
            days={mode === 'day' ? [viewDate] : undefined}
            events={events}
            tz={tz}
            startHour={startHour}
            endHour={endHour}
            slotIntervalMin={slotIntervalMin}
            weekStartsOn={weekStartsOn}
            availability={availability}
            onCellClick={({ startMin, dateYmd }) => openCreate(startMin, dateYmd)}
            onEventClick={openEvent}
            onEventDrop={async ({ event, dayKey, startMin }) => {
              if (event.tipo !== 'turno') return;
              const startsAt = atMinutes(dayKey, startMin, tz).toISOString();
              await api.saveAppointment(event.id, {
                professionalId: event.raw.professional_id || event.raw.professional.id,
                serviceId: event.raw.service_id || event.raw.service.id,
                startsAt,
                status: event.raw.status,
                notes: event.raw.notes,
              });
              await refresh();
            }}
          />
        )}
      </div>

      <div className="cal-fab lg:hidden">
        <button
          className="create-btn"
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Crear"
        >
          <Plus size={22} className="text-[#1a73e8]" />
          Crear
        </button>
        {menuOpen && (
          <CreateMenu
            className="bottom-full right-0 mb-2"
            onTurno={() => openCreate(9 * 60, ymd(viewDate, tz))}
            onBloqueo={() => {
              setBlockDefaults({ date: ymd(viewDate, tz) });
              setBloqueo('new');
              setMenuOpen(false);
            }}
          />
        )}
      </div>

      <AppointmentModal
        open={Boolean(turno)}
        appointment={turno && turno !== 'new' ? turno : null}
        defaults={defaults}
        professionals={professionals}
        services={services}
        tz={tz}
        saving={saving}
        onClose={() => setTurno(null)}
        onSave={async (payload) => {
          setSaving(true);
          try {
            await api.saveAppointment(payload.id, payload);
            setTurno(null);
            await refresh();
          } finally {
            setSaving(false);
          }
        }}
        onCancelTurno={async (id) => {
          await api.cancelAppointment(id);
          setTurno(null);
          await refresh();
        }}
      />
      <BlockModal
        open={Boolean(bloqueo)}
        block={bloqueo && bloqueo !== 'new' ? bloqueo : null}
        defaults={blockDefaults}
        professionals={professionals}
        tz={tz}
        saving={saving}
        onClose={() => setBloqueo(null)}
        onSave={async (payload) => {
          setSaving(true);
          try {
            await api.saveBlock(payload.id, payload);
            setBloqueo(null);
            await refresh();
          } finally {
            setSaving(false);
          }
        }}
        onDelete={async (id) => {
          await api.deleteBlock(id);
          setBloqueo(null);
          await refresh();
        }}
      />
    </div>
  );
}

function rangeFor(viewDate, mode, weekStartsOn) {
  if (mode === 'day') {
    const from = new Date(viewDate);
    from.setHours(0, 0, 0, 0);
    return { from, to: addDays(from, 1) };
  }
  if (mode === 'month') {
    const from = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    return { from: addDays(from, -7), to: addDays(from, 38) };
  }
  const from = startOfView(viewDate, weekStartsOn);
  return { from, to: addDays(from, 7) };
}

function startOfView(date, weekStartsOn) {
  const tmp = new Date(date);
  const day = tmp.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  tmp.setDate(tmp.getDate() - diff);
  tmp.setHours(0, 0, 0, 0);
  return tmp;
}

function toMin(value) {
  const [h, m] = String(value).split(':');
  return Number(h) * 60 + Number(m || 0);
}

function CreateMenu({ onTurno, onBloqueo, className = 'left-0 top-14' }) {
  return (
    <div className={`absolute z-10 w-52 rounded-lg bg-white py-2 shadow-lg ring-1 ring-black/5 ${className}`}>
      <button className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-[#f1f3f4]" onClick={onTurno}>
        <CalendarPlus size={16} /> Turno
      </button>
      <button className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-[#f1f3f4]" onClick={onBloqueo}>
        <Plus size={16} /> Bloqueo de horario
      </button>
    </div>
  );
}

function ShareLink({ href, label }) {
  return (
    <a
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#1a73e8] hover:bg-[#f1f3f4]"
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Abrir página pública de reserva"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ExternalLink size={14} className="shrink-0 text-[#70757a]" aria-hidden="true" />
    </a>
  );
}
