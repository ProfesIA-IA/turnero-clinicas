import { useState } from 'react';
import { createPortal } from 'react-dom';
import ExtraFields from './ExtraFields';
import { useClinic } from '../clinic';
import { formFieldsOf } from '../lib/formFields';

export default function PatientForm({ form, onClose, onSave, stacked = false, requirePhone = false }) {
  const { settings } = useClinic();
  const fields = Object.fromEntries(formFieldsOf(settings, 'patient').map((field) => [field.key, field]));
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
              dni: state.dni,
              notes: state.notes,
              extra: state.extra || {},
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
          {fields.name?.enabled && (
            <label className="field">
              <span>{fields.name.label}</span>
              <input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} required />
            </label>
          )}
          {fields.dni?.enabled !== false && (
            <label className="field">
              <span>{fields.dni?.label || 'DNI'}</span>
              <input value={state.dni || ''} onChange={(e) => setState({ ...state, dni: e.target.value })} required={fields.dni?.required} />
            </label>
          )}
          {fields.phone?.enabled && (
            <label className="field">
              <span>{fields.phone.label}</span>
              <input
                value={state.phone}
                onChange={(e) => setState({ ...state, phone: e.target.value })}
                required={requirePhone || fields.phone.required}
              />
            </label>
          )}
          {fields.email?.enabled && (
            <label className="field">
              <span>{fields.email.label}</span>
              <input type="email" value={state.email} onChange={(e) => setState({ ...state, email: e.target.value })} required={fields.email.required} />
            </label>
          )}
          {fields.notes?.enabled && (
            <label className="field">
              <span>{fields.notes.label}</span>
              <textarea rows={2} value={state.notes} onChange={(e) => setState({ ...state, notes: e.target.value })} required={fields.notes.required} />
            </label>
          )}
          <ExtraFields entity="patient" value={state.extra} onChange={(extra) => setState({ ...state, extra })} />
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
  return { id: null, name: '', dni: '', phone: '', email: '', notes: '', extra: {}, ...overrides };
}

export function toPatientForm(row) {
  return {
    id: row.id,
    name: row.name || '',
    dni: row.dni || '',
    phone: row.phone || '',
    email: row.email || '',
    notes: row.notes || '',
    extra: row.extra || {},
  };
}
