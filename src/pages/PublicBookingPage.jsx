import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import MiniCalendar from '../components/MiniCalendar';
import PoweredBy from '../components/PoweredBy';
import { formatTime, ymd } from '../lib/calendar';

export default function PublicBookingPage({ kind }) {
  const { slug } = useParams();
  const [calendar, setCalendar] = useState(null);
  const [date, setDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState('horario');
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .publicCalendar(kind, slug)
      .then((res) => {
        setCalendar(res.data);
        if (kind === 'profesional') {
          setServiceId(String(res.data.services?.[0]?.id || ''));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [kind, slug]);

  const duration = useMemo(() => {
    if (!calendar) return 30;
    if (kind === 'servicio') return calendar.duration_min || calendar.durationMin || 30;
    return calendar.services?.find((s) => String(s.id) === String(serviceId))?.duration_min || 30;
  }, [calendar, kind, serviceId]);

  useEffect(() => {
    if (!calendar) return;
    const dateYmd = ymd(date, calendar.timezone);
    const params = new URLSearchParams({ date: dateYmd });
    if (kind === 'profesional' && serviceId) params.set('serviceId', serviceId);
    api
      .publicSlots(kind, slug, `?${params.toString()}`)
      .then((res) => {
        setSlots(res.data.slots || []);
        setSelected(null);
        setStep('horario');
      })
      .catch(() => setSlots([]));
  }, [calendar, date, kind, slug, serviceId]);

  const weekDays = startOfWeek(date, { weekStartsOn: 1 });
  const strip = Array.from({ length: 7 }, (_, i) => addDays(weekDays, i));

  async function book(ev) {
    ev.preventDefault();
    if (!selected) return;
    setError('');
    try {
      const res = await api.publicBook(kind, slug, {
        serviceId: kind === 'profesional' ? Number(serviceId) : calendar.id,
        professionalId: selected.professionalId,
        startsAt: selected.start,
        ...form,
      });
      setDone(res.data);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <PublicShell>
        <div className="grid min-h-full place-items-center text-[#70757a]">Cargando calendario…</div>
      </PublicShell>
    );
  }
  if (!calendar) {
    return (
      <PublicShell>
        <div className="grid min-h-full place-items-center p-6 text-[#70757a]">{error || 'Calendario no disponible'}</div>
      </PublicShell>
    );
  }

  const fields = (calendar.bookingFields?.length
    ? calendar.bookingFields
    : [
        { key: 'name', label: 'Nombre', type: 'text', enabled: true, required: true },
        { key: 'phone', label: 'Teléfono', type: 'tel', enabled: true, required: true },
        { key: 'email', label: 'Email', type: 'email', enabled: true, required: false },
      ]
  ).filter((field) => field.enabled);

  if (done) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-lg p-8 text-center">
          <h1 className="text-2xl">Turno reservado</h1>
          <p className="mt-3 text-[#70757a]">
            {done.service?.name} con {done.professional?.name} el {formatTime(new Date(done.starts_at), calendar.timezone)} hs.
          </p>
        </div>
      </PublicShell>
    );
  }

  if (step === 'datos' && selected) {
    return (
      <PublicShell>
        <div className="min-h-full bg-white">
          <div className="border-b border-[#dadce0] bg-[#e8f0fe] px-4 py-2 text-sm text-[#174ea6] sm:px-6">
            Reserva online · {calendar.clinicName}
          </div>
          <div className="mx-auto max-w-md px-4 py-6 sm:px-6">
            <button className="pill-btn mb-4" type="button" onClick={() => setStep('horario')}>
              Volver al horario
            </button>
            <h1 className="text-2xl">Tus datos</h1>
            <p className="mt-2 text-sm text-[#70757a]">
              {calendar.name} · {format(date, "EEEE d 'de' MMMM", { locale: es })} · {formatSlotLabel(selected, kind)}
            </p>
            {calendar.bookingIntro && <p className="mt-3 text-sm text-[#3c4043]">{calendar.bookingIntro}</p>}
            <form className="mt-6 space-y-3" onSubmit={book}>
              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              {fields.map((field) => (
                <label className="field" key={field.key}>
                  <span>
                    {field.label}
                    {field.required ? '' : ' (opcional)'}
                  </span>
                  {field.type === 'textarea' ? (
                    <textarea rows={3} value={form[field.key] || ''} required={field.required} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} />
                  ) : field.type === 'select' ? (
                    <select value={form[field.key] || ''} required={field.required} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}>
                      <option value="">Elegir…</option>
                      {(field.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <input type="checkbox" checked={Boolean(form[field.key])} onChange={(e) => setForm({ ...form, [field.key]: e.target.checked })} />
                  ) : (
                    <input
                      type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.type === 'number' ? 'number' : 'text'}
                      value={form[field.key] || ''}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      required={field.required}
                    />
                  )}
                </label>
              ))}
              <button className="pill-btn primary" type="submit">
                Confirmar turno
              </button>
            </form>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="min-h-full bg-white">
      <div className="border-b border-[#dadce0] bg-[#e8f0fe] px-4 py-2 text-sm text-[#174ea6] sm:px-6">
        Reserva online · {calendar.clinicName}
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[280px_1fr] lg:gap-8">
        <div>
          <div className="text-sm text-[#70757a]">{calendar.clinicName}</div>
          <h1 className="mt-1 text-2xl font-normal sm:text-3xl">{calendar.name}</h1>
          <div className="mt-3 text-sm text-[#70757a]">Citas de {duration} min</div>
          {kind === 'profesional' && calendar.services?.length > 1 && (
            <label className="field mt-4">
              <span>Servicio</span>
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {calendar.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.duration_min} min)
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-6">
            <MiniCalendar value={date} onChange={setDate} weekStartsOn={1} cursor={date} onCursorChange={setDate} />
          </div>
        </div>
        <div>
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <h2 className="text-base sm:text-lg">Seleccioná una hora para la cita</h2>
            <div className="text-xs text-[#70757a]">({calendar.timezone})</div>
          </div>
          <div className="mb-6 grid grid-cols-7 gap-1 sm:gap-2">
            {strip.map((day) => {
              const active = isSameDay(day, date);
              return (
                <button
                  key={day.toISOString()}
                  className={`rounded-full px-0.5 py-2 text-center sm:px-2 sm:py-3 ${active ? 'bg-[#1a73e8] text-white' : 'hover:bg-[#f1f3f4]'}`}
                  onClick={() => setDate(day)}
                >
                  <div className="text-[11px] uppercase">{format(day, 'EEE', { locale: es }).replace('.', '')}</div>
                  <div className="text-lg">{format(day, 'd')}</div>
                </button>
              );
            })}
          </div>
          <div className="flex max-w-xs flex-col gap-3">
            {slots.map((slot) => {
              const active = selected?.start === slot.start && selected?.professionalId === slot.professionalId;
              return (
                <button
                  key={`${slot.start}-${slot.professionalId}`}
                  className={`time-chip ${active ? 'active' : ''}`}
                  onClick={() => setSelected(slot)}
                >
                  {formatSlotLabel(slot, kind)}
                </button>
              );
            })}
            {!slots.length && <div className="text-sm text-[#70757a]">No hay horarios disponibles este día.</div>}
          </div>
          {selected && (
            <div className="fixed bottom-20 left-1/2 z-20 flex w-[min(100%-2rem,24rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-full border border-[#dadce0] bg-white p-2 shadow-lg">
              <span className="pl-3 text-sm font-medium">{formatSlotLabel(selected, kind)}</span>
              <button className="pill-btn primary" type="button" onClick={() => setStep('datos')}>
                Continuar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </PublicShell>
  );
}

function PublicShell({ children }) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="min-h-0 flex-1">{children}</div>
      <PoweredBy />
    </div>
  );
}

function formatSlotLabel(slot, kind) {
  const time = new Date(slot.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (kind === 'servicio') return `${time} · ${slot.professionalName}`;
  return time;
}
