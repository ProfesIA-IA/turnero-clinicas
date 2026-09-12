import { useEffect, useState } from 'react';
import { atMinutes, formatTime, ymd } from '../lib/calendar';

export default function BlockModal({ open, onClose, onSave, onDelete, block, defaults, professionals, tz, saving }) {
  const [form, setForm] = useState(empty());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (block) {
      setForm({
        id: block.id,
        title: block.title || 'Bloqueo',
        professionalId: block.professional_id ? String(block.professional_id) : '',
        date: ymd(block.starts_at || block.start, tz),
        startTime: padTime(formatTime(block.starts_at || block.start, tz)),
        endTime: padTime(formatTime(block.ends_at || block.end, tz)),
        reason: block.reason || '',
      });
    } else {
      setForm({
        ...empty(),
        professionalId: defaults?.professionalId ? String(defaults.professionalId) : '',
        date: defaults?.date || ymd(new Date(), tz),
        startTime: defaults?.startTime || '13:00',
        endTime: defaults?.endTime || '14:00',
      });
    }
  }, [open, block, defaults, tz]);

  if (!open) return null;

  async function submit(ev) {
    ev.preventDefault();
    setError('');
    try {
      await onSave({
        id: form.id,
        title: form.title,
        professionalId: form.professionalId ? Number(form.professionalId) : null,
        startsAt: atMinutes(form.date, toMin(form.startTime), tz).toISOString(),
        endsAt: atMinutes(form.date, toMin(form.endTime), tz).toISOString(),
        reason: form.reason,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(ev) => ev.stopPropagation()} onSubmit={submit}>
        <div className="flex items-center justify-between border-b border-[#dadce0] px-5 py-4">
          <h2 className="text-lg font-medium">{form.id ? 'Bloqueo de horario' : 'Nuevo bloqueo'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="grid gap-3 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="field">
            <span>Título</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <label className="field">
            <span>Profesional</span>
            <select value={form.professionalId} onChange={(e) => setForm({ ...form, professionalId: e.target.value })}>
              <option value="">Toda la clínica</option>
              {professionals.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="field">
              <span>Fecha</span>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </label>
            <label className="field">
              <span>Desde</span>
              <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
            </label>
          </div>
          <label className="field">
            <span>Motivo</span>
            <textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
        </div>
        <div className="flex items-center justify-between border-t border-[#dadce0] px-5 py-3">
          <div>
            {form.id && (
              <button type="button" className="text-sm text-red-600" onClick={() => onDelete?.(form.id)}>
                Eliminar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="pill-btn" onClick={onClose}>Cerrar</button>
            <button type="submit" className="pill-btn primary" disabled={saving}>
              Guardar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function empty() {
  return { id: null, title: 'Bloqueo', professionalId: '', date: '', startTime: '13:00', endTime: '14:00', reason: '' };
}

function toMin(value) {
  const [h, m] = String(value).split(':');
  return Number(h) * 60 + Number(m || 0);
}

function padTime(value) {
  const [h, m] = String(value).split(':');
  return `${String(h).padStart(2, '0')}:${String(m || '00').padStart(2, '0')}`;
}
