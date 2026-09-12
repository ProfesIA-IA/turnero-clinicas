import { useState } from 'react';
import { createPortal } from 'react-dom';

export default function PatientForm({ form, onClose, onSave, stacked = false, requirePhone = false }) {
  const [state, setState] = useState(form);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  return createPortal(
    <div className={`modal-backdrop${stacked ? ' stacked' : ''}`} onClick={onClose}>
      <form
        className="modal-card"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setError('');
          setSaving(true);
          try {
            await onSave({
              name: state.name,
              phone: state.phone,
              email: state.email,
              notes: state.notes,
            });
          } catch (err) {
            setError(err.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="border-b border-[#dadce0] px-5 py-4 text-lg">
          {state.id ? 'Editar paciente' : 'Nuevo paciente'}
        </div>
        <div className="grid gap-3 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="field">
            <span>Nombre</span>
            <input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} required />
          </label>
          <label className="field">
            <span>Teléfono</span>
            <input
              value={state.phone}
              onChange={(e) => setState({ ...state, phone: e.target.value })}
              required={requirePhone}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={state.email} onChange={(e) => setState({ ...state, email: e.target.value })} />
          </label>
          <label className="field">
            <span>Notas</span>
            <textarea rows={2} value={state.notes} onChange={(e) => setState({ ...state, notes: e.target.value })} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#dadce0] px-5 py-3">
          <button type="button" className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="pill-btn primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export function emptyPatient(overrides = {}) {
  return { id: null, name: '', phone: '', email: '', notes: '', ...overrides };
}

export function toPatientForm(row) {
  return {
    id: row.id,
    name: row.name || '',
    phone: row.phone || '',
    email: row.email || '',
    notes: row.notes || '',
  };
}
