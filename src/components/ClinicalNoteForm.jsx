import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import AppointmentSearch from './AppointmentSearch';
import { StoredImagePreview } from './ClinicalFilePreview';

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
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);

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

  function addFiles(list) {
    const next = [...(list || [])];
    if (!next.length) return;
    setPendingFiles((current) => [...current, ...next]);
  }

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
                <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#dadce0] px-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <StoredImagePreview file={file} />
                    <span className="truncate">{file.original_name}</span>
                  </div>
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
          <div className="field">
            <span>Imágenes o archivos</span>
            <p className="text-xs text-[#70757a]">Imágenes, PDF o documentos. Podés arrastrarlos o elegirlos.</p>
            <button
              type="button"
              className={`mt-1 grid min-h-28 place-items-center rounded-xl border border-dashed px-4 py-6 text-center ${
                dragOver ? 'border-[#1a73e8] bg-[#e8f0fe]' : 'border-[#dadce0] bg-[#f8f9fa]'
              }`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(ev) => {
                ev.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(ev) => {
                ev.preventDefault();
                setDragOver(false);
                addFiles(ev.dataTransfer.files);
              }}
            >
              <span>
                <span className="block text-sm font-medium text-[#3c4043]">Arrastrá para subir</span>
                <span className="mt-1 block text-xs text-[#70757a]">o hacé clic para elegir archivos</span>
              </span>
            </button>
            <input
              ref={fileInput}
              className="hidden"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {pendingFiles.map((file) => (
                  <PendingFile
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    file={file}
                    onRemove={() => setPendingFiles((current) => current.filter((item) => item !== file))}
                  />
                ))}
              </div>
            )}
          </div>
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

function PendingFile({ file, onRemove }) {
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);
  const isImage = String(file.type || '').startsWith('image/');

  useEffect(() => {
    if (!isImage) return undefined;
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file, isImage]);

  return (
    <>
      <div className="relative">
        {isImage && url ? (
          <button type="button" onClick={() => setOpen(true)} title="Ver imagen">
            <img src={url} alt={file.name} className="h-24 w-24 rounded-lg border border-[#dadce0] object-cover" />
          </button>
        ) : (
          <div className="max-w-40 truncate rounded-lg border border-[#dadce0] px-3 py-2 text-xs">{file.name}</div>
        )}
        <button
          type="button"
          aria-label="Quitar archivo"
          className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[#3c4043] text-sm font-medium leading-none text-white shadow"
          onClick={onRemove}
        >
          ×
        </button>
      </div>
      {open && url && (
        <div className="modal-backdrop stacked" onClick={() => setOpen(false)}>
          <div className="relative max-h-[90vh] max-w-[min(960px,92vw)]" onClick={(ev) => ev.stopPropagation()}>
            <button
              type="button"
              aria-label="Cerrar vista previa"
              className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full bg-[#3c4043] text-lg text-white"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <img src={url} alt={file.name} className="max-h-[90vh] max-w-full rounded-xl bg-white object-contain" />
          </div>
        </div>
      )}
    </>
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
