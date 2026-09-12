import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import AppointmentSearch from './AppointmentSearch';

export default function ClinicalNoteForm({
  patientId,
  appointments = [],
  professionals = [],
  services = [],
  note,
  tz,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => toForm(note));
  const [fields, setFields] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedAppointment = useMemo(
    () => appointments.find((item) => String(item.id) === String(form.appointmentId)),
    [appointments, form.appointmentId]
  );

  useEffect(() => {
    setForm(toForm(note));
    setPendingFiles([]);
    setError('');
  }, [note]);

  useEffect(() => {
    const professionalId = selectedAppointment?.professional?.id || form.professionalId;
    const serviceId = selectedAppointment?.service?.id || form.serviceId;
    if (!professionalId && !serviceId) {
      setFields([]);
      return undefined;
    }
    const params = new URLSearchParams();
    if (professionalId) params.set('professionalId', professionalId);
    if (serviceId) params.set('serviceId', serviceId);
    let cancelled = false;
    api
      .clinicalFields(`?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        const nextFields = res.data || [];
        setFields(nextFields);
        setForm((prev) => ({
          ...prev,
          customValues: mergeCustomValues(nextFields, prev.customValues, note?.custom_values),
        }));
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.appointmentId, form.professionalId, form.serviceId, selectedAppointment, note?.id]);

  async function submit(ev) {
    ev.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.saveClinicalNote(
        patientId,
        {
          appointmentId: form.appointmentId || null,
          professionalId: selectedAppointment ? undefined : form.professionalId || null,
          serviceId: selectedAppointment ? undefined : form.serviceId || null,
          details: form.details,
          customValues: form.customValues,
        },
        note?.id
      );
      if (pendingFiles.length) {
        await api.uploadClinicalFiles(res.data.id, pendingFiles);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop stacked" onClick={onClose}>
      <form className="modal-card wide" onClick={(ev) => ev.stopPropagation()} onSubmit={submit}>
        <div className="border-b border-[#dadce0] px-5 py-4 text-lg">
          {note?.id ? 'Editar entrada' : 'Nueva entrada de historia clínica'}
        </div>
        <div className="grid max-h-[min(70vh,640px)] gap-3 overflow-auto px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <AppointmentSearch
            appointments={appointments}
            tz={tz}
            value={form.appointmentId}
            onChange={(appointmentId) => setForm({ ...form, appointmentId })}
          />
          {!selectedAppointment && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="field">
                <span>Profesional</span>
                <select
                  value={form.professionalId}
                  onChange={(e) => setForm({ ...form, professionalId: e.target.value })}
                >
                  <option value="">Sin especificar</option>
                  {professionals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Servicio</span>
                <select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
                  <option value="">Sin especificar</option>
                  {services.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <label className="field">
            <span>Detalles de la atención</span>
            <textarea
              rows={5}
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              placeholder="Evolución, indicaciones, observaciones…"
            />
          </label>
          {fields.length > 0 && (
            <div className="grid gap-3 rounded-lg border border-[#dadce0] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[#70757a]">
                Campos personalizados
              </div>
              {fields.map((field) => (
                <CustomFieldInput
                  key={field.id}
                  field={field}
                  value={form.customValues[String(field.id)]}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      customValues: { ...form.customValues, [String(field.id)]: value },
                    })
                  }
                />
              ))}
            </div>
          )}
          {note?.files?.length > 0 && (
            <div className="grid gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-[#70757a]">Archivos actuales</div>
              {note.files.map((file) => (
                <div key={file.id} className="flex items-center justify-between rounded-lg border border-[#dadce0] px-3 py-2 text-sm">
                  <span className="truncate">{file.original_name}</span>
                  <button
                    type="button"
                    className="text-sm text-red-600"
                    onClick={async () => {
                      await api.deleteClinicalFile(file.id);
                      onSaved(false);
                    }}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="field">
            <span>Imágenes o archivos</span>
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={(e) => setPendingFiles([...e.target.files])}
            />
            {pendingFiles.length > 0 && (
              <div className="text-xs text-[#70757a]">{pendingFiles.length} archivo(s) para adjuntar</div>
            )}
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
    </div>
  );
}

function CustomFieldInput({ field, value, onChange }) {
  const label = `${field.label}${field.required ? ' *' : ''}`;
  if (field.field_type === 'textarea') {
    return (
      <label className="field">
        <span>{label}</span>
        <textarea rows={3} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }
  if (field.field_type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    );
  }
  if (field.field_type === 'select') {
    const options = Array.isArray(field.options) ? field.options : [];
    return (
      <label className="field">
        <span>{label}</span>
        <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Elegí una opción</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const type = field.field_type === 'number' || field.field_type === 'date' ? field.field_type : 'text';
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function toForm(note) {
  const customValues = {};
  for (const item of note?.custom_values || []) {
    customValues[String(item.id)] = item.value;
  }
  return {
    appointmentId: note?.appointment_id ? String(note.appointment_id) : '',
    professionalId: note?.professional_id ? String(note.professional_id) : '',
    serviceId: note?.service_id ? String(note.service_id) : '',
    details: note?.details || '',
    customValues,
  };
}

function mergeCustomValues(fields, current, saved) {
  const next = { ...current };
  const savedMap = new Map((saved || []).map((item) => [String(item.id), item.value]));
  for (const field of fields) {
    const key = String(field.id);
    if (next[key] === undefined) next[key] = savedMap.get(key) ?? (field.field_type === 'checkbox' ? false : '');
  }
  return next;
}
