import { useState } from 'react';
import { api } from '../api';
import { useClinic } from '../clinic';

const DEFAULT_BOOKING_FIELDS = [
  { key: 'name', label: 'Nombre', enabled: true, required: true },
  { key: 'phone', label: 'Teléfono', enabled: true, required: true },
  { key: 'email', label: 'Email', enabled: true, required: false },
  { key: 'notes', label: 'Notas', enabled: false, required: false },
];

function bookingFieldsOf(settings) {
  const saved = Array.isArray(settings?.booking_fields) ? settings.booking_fields : [];
  return DEFAULT_BOOKING_FIELDS.map((field) => saved.find((item) => item.key === field.key) || field);
}

function updateField(current, setForm, key, patch) {
  setForm({
    ...current,
    booking_fields: bookingFieldsOf(current).map((field) => (field.key === key ? { ...field, ...patch } : field)),
  });
}

export default function SettingsPage() {
  const { settings, reload } = useClinic();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const current = form || settings;
  if (!current) return <div className="p-6">Cargando…</div>;

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <h1 className="mb-4 text-2xl">Configuración</h1>
      <form
        className="max-w-xl space-y-4"
        onSubmit={async (ev) => {
          ev.preventDefault();
          setError('');
          try {
            await api.saveSettings({
              name: current.name,
              timezone: current.timezone,
              startHour: Number(current.start_hour),
              endHour: Number(current.end_hour),
              slotIntervalMin: Number(current.slot_interval_min),
              weekStartsOn: Number(current.week_starts_on),
              bookingFields: bookingFieldsOf(current),
            });
            await reload();
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="field">
          <span>Nombre de la clínica</span>
          <input value={current.name} onChange={(e) => setForm({ ...current, name: e.target.value })} />
        </label>
        <label className="field">
          <span>Zona horaria</span>
          <input value={current.timezone} onChange={(e) => setForm({ ...current, timezone: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span>Hora inicio agenda</span>
            <input type="number" min="0" max="23" value={current.start_hour} onChange={(e) => setForm({ ...current, start_hour: e.target.value })} />
          </label>
          <label className="field">
            <span>Hora fin agenda</span>
            <input type="number" min="1" max="24" value={current.end_hour} onChange={(e) => setForm({ ...current, end_hour: e.target.value })} />
          </label>
          <label className="field">
            <span>Intervalo de slots (min)</span>
            <input type="number" min="5" step="5" value={current.slot_interval_min} onChange={(e) => setForm({ ...current, slot_interval_min: e.target.value })} />
          </label>
          <label className="field">
            <span>La semana empieza</span>
            <select value={current.week_starts_on} onChange={(e) => setForm({ ...current, week_starts_on: e.target.value })}>
              <option value="0">Domingo</option>
              <option value="1">Lunes</option>
            </select>
          </label>
        </div>
        <div className="rounded-xl border border-[#dadce0] p-4">
          <h2 className="text-base">Datos de la reserva online</h2>
          <p className="mt-1 mb-3 text-sm text-[#70757a]">Qué se le pide a quien reserva un turno desde el enlace público.</p>
          <div className="space-y-2">
            {bookingFieldsOf(current).map((field) => (
              <div key={field.key} className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex min-w-36 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    disabled={field.key === 'name'}
                    onChange={(e) => updateField(current, setForm, field.key, { enabled: e.target.checked, required: e.target.checked ? field.required : false })}
                  />
                  {field.label}
                </label>
                <label className="flex items-center gap-2 text-[#70757a]">
                  <input
                    type="checkbox"
                    checked={field.required}
                    disabled={field.key === 'name' || !field.enabled}
                    onChange={(e) => updateField(current, setForm, field.key, { required: e.target.checked })}
                  />
                  Obligatorio
                </label>
              </div>
            ))}
          </div>
        </div>
        <button className="pill-btn primary" type="submit">
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}
