import { useState } from 'react';
import { api } from '../api';
import { useClinic } from '../clinic';

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
        <button className="pill-btn primary" type="submit">
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}
