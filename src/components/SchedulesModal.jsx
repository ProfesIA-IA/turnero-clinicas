import { useEffect, useState } from 'react';
import { api } from '../api';
import { WEEKDAYS_LONG } from '../lib/calendar';

export default function SchedulesModal({ professional, onClose, onSaved }) {
  const [windows, setWindows] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .professional(professional.id)
      .then((res) => {
        if (cancelled) return;
        setWindows(
          (res.data.schedules || []).map((row) => ({
            weekday: row.weekday,
            startTime: String(row.start_time).slice(0, 5),
            endTime: String(row.end_time).slice(0, 5),
          }))
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [professional.id]);

  function updateWindow(index, patch) {
    setWindows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card wide"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          setError('');
          setSaving(true);
          try {
            await api.saveSchedules(professional.id, windows);
            await onSaved?.();
            onClose();
          } catch (err) {
            setError(err.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="border-b border-[#dadce0] px-5 py-4">
          <div className="text-lg">Horarios · {professional.name}</div>
          <p className="mt-1 text-sm text-[#70757a]">
            Franjas semanales de atención. La reserva pública y los turnos usan estos horarios, menos bloqueos y turnos
            ya cargados.
          </p>
        </div>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          {loading && <div className="text-sm text-[#70757a] sm:col-span-2">Cargando horarios…</div>}
          {!loading &&
            WEEKDAYS_LONG.map((label, weekday) => {
              const rows = windows
                .map((row, index) => ({ ...row, index }))
                .filter((row) => Number(row.weekday) === weekday);
              return (
                <div key={label} className="rounded-xl border border-[#dadce0] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="font-medium">{label}</div>
                    <button
                      type="button"
                      className="text-sm text-[#1a73e8]"
                      onClick={() => setWindows((prev) => [...prev, { weekday, startTime: '09:00', endTime: '13:00' }])}
                    >
                      + Franja
                    </button>
                  </div>
                  {!rows.length && <div className="text-sm text-[#70757a]">Sin atención</div>}
                  {rows.map((row) => (
                    <div key={row.index} className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                      <input
                        type="time"
                        className="min-w-0 flex-1 rounded-lg border border-[#dadce0] px-2 py-1"
                        value={row.startTime}
                        onChange={(e) => updateWindow(row.index, { startTime: e.target.value })}
                      />
                      <span className="text-[#70757a]">a</span>
                      <input
                        type="time"
                        className="min-w-0 flex-1 rounded-lg border border-[#dadce0] px-2 py-1"
                        value={row.endTime}
                        onChange={(e) => updateWindow(row.index, { endTime: e.target.value })}
                      />
                      <button
                        type="button"
                        className="text-sm text-red-600"
                        onClick={() => setWindows((prev) => prev.filter((_, i) => i !== row.index))}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
        </div>
        {error && <div className="px-5 pb-2 text-sm text-red-600">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-[#dadce0] px-5 py-3">
          <button type="button" className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="pill-btn primary" disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar horarios'}
          </button>
        </div>
      </form>
    </div>
  );
}
