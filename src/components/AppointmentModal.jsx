import { useEffect, useMemo, useState } from 'react';
import { atMinutes, formatTime, ymd } from '../lib/calendar';
import { api } from '../api';
import PatientPicker from './PatientPicker';
import ClinicalNoteForm from './ClinicalNoteForm';
import ClinicalHistorySummary from './ClinicalHistorySummary';

const STATUSES = [
  { id: 'RESERVADO', label: 'Reservado' },
  { id: 'CONFIRMADO', label: 'Confirmado' },
  { id: 'COMPLETADO', label: 'Completado' },
  { id: 'CANCELADO', label: 'Cancelado' },
];

export default function AppointmentModal({
  open,
  onClose,
  onSave,
  onCancelTurno,
  appointment,
  defaults,
  professionals,
  services,
  tz,
  saving,
}) {
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [clinicalView, setClinicalView] = useState(null);
  const [clinicalNotes, setClinicalNotes] = useState([]);
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open) {
      setClinicalView(null);
      return;
    }
    setError('');
    if (appointment) {
      setForm({
        id: appointment.id,
        patientId: appointment.patient?.id || appointment.patient_id || null,
        name: appointment.patient?.name || '',
        phone: appointment.patient?.phone || '',
        email: appointment.patient?.email || '',
        professionalId: String(appointment.professional?.id || appointment.professional_id),
        serviceId: String(appointment.service?.id || appointment.service_id),
        date: ymd(appointment.starts_at || appointment.start, tz),
        time: padTime(formatTime(appointment.starts_at || appointment.start, tz)),
        status: appointment.status,
        notes: appointment.notes || '',
      });
    } else {
      setForm({
        ...emptyForm(),
        professionalId: String(defaults?.professionalId || professionals[0]?.id || ''),
        serviceId: String(defaults?.serviceId || services[0]?.id || ''),
        date: defaults?.date || ymd(new Date(), tz),
        time: defaults?.time || '09:00',
      });
    }
  }, [open, appointment, defaults, professionals, services, tz]);

  const selectedService = useMemo(
    () => services.find((item) => String(item.id) === String(form.serviceId)),
    [services, form.serviceId]
  );

  async function loadClinical() {
    if (!form.patientId) {
      setClinicalNotes([]);
      setPatientAppointments([]);
      return;
    }
    const [patientRes, notesRes] = await Promise.all([
      api.patient(form.patientId),
      api.clinicalNotes(form.patientId),
    ]);
    setPatientAppointments(patientRes.data?.appointments || []);
    setClinicalNotes(notesRes.data || []);
  }

  async function openClinical(view) {
    try {
      await loadClinical();
      setClinicalView(view);
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadHistory(patientId) {
    setDownloading(true);
    try {
      await api.exportClinicalHistory(patientId);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  if (!open) return null;

  async function submit(ev) {
    ev.preventDefault();
    setError('');
    try {
      await onSave({
        id: form.id,
        professionalId: Number(form.professionalId),
        serviceId: Number(form.serviceId),
        startsAt: atMinutes(form.date, timeToMinutes(form.time), tz).toISOString(),
        status: form.status,
        notes: form.notes,
        patientId: form.patientId || undefined,
        patient: { name: form.name, phone: form.phone, email: form.email },
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(ev) => ev.stopPropagation()} onSubmit={submit}>
        <div className="flex items-center justify-between border-b border-[#dadce0] px-5 py-4">
          <h2 className="text-lg font-medium">{form.id ? 'Turno' : 'Nuevo turno'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="grid gap-3 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PatientPicker
              value={{ id: form.patientId, name: form.name, phone: form.phone, email: form.email }}
              onChange={(patient) =>
                setForm({
                  ...form,
                  patientId: patient.id,
                  name: patient.name,
                  phone: patient.phone,
                  email: patient.email,
                })
              }
            />
            <label className="field">
              <span>Teléfono</span>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </label>
            <label className="field sm:col-span-1">
              <span>Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="field">
              <span>Profesional</span>
              <select value={form.professionalId} onChange={(e) => setForm({ ...form, professionalId: e.target.value })}>
                {professionals.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Servicio {selectedService ? `(${selectedService.duration_min} min)` : ''}</span>
              <select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
                {services.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Fecha</span>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </label>
            <label className="field">
              <span>Hora</span>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
            </label>
            <label className="field">
              <span>Estado</span>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field col-span-1 sm:col-span-2">
              <span>Notas</span>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#dadce0] px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {form.id && appointment?.status !== 'CANCELADO' && (
              <button type="button" className="text-sm text-red-600" onClick={() => onCancelTurno?.(form.id)}>
                Cancelar turno
              </button>
            )}
            {form.patientId && (
              <>
                <button
                  type="button"
                  className="text-sm text-[#1a73e8]"
                  onClick={() => openClinical('note')}
                >
                  Nueva entrada
                </button>
                <button
                  type="button"
                  className="text-sm text-[#1a73e8]"
                  onClick={() => openClinical('summary')}
                >
                  Ver historia
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="pill-btn" onClick={onClose}>
              Cerrar
            </button>
            <button
              type="submit"
              className="pill-btn primary"
              disabled={saving}
            >
              Guardar
            </button>
          </div>
        </div>
      </form>
    </div>
      {clinicalView === 'note' && (
        <ClinicalNoteForm
          patientId={form.patientId}
          appointments={patientAppointments}
          professionals={professionals}
          services={services}
          note={
            form.id
              ? { appointment_id: form.id, professional_id: form.professionalId, service_id: form.serviceId }
              : null
          }
          tz={tz}
          onClose={() => setClinicalView(null)}
          onSaved={async () => {
            await loadClinical();
            setClinicalView(null);
          }}
        />
      )}
      {clinicalView === 'summary' && (
        <ClinicalHistorySummary
          patient={{ name: form.name, phone: form.phone, email: form.email }}
          notes={clinicalNotes}
          tz={tz}
          downloading={downloading}
          onDownload={() => downloadHistory(form.patientId)}
          onClose={() => setClinicalView(null)}
        />
      )}
    </>
  );
}

function emptyForm() {
  return {
    id: null,
    patientId: null,
    name: '',
    phone: '',
    email: '',
    professionalId: '',
    serviceId: '',
    date: '',
    time: '09:00',
    status: 'RESERVADO',
    notes: '',
  };
}

function timeToMinutes(value) {
  const [h, m] = String(value).split(':');
  return Number(h) * 60 + Number(m || 0);
}

function padTime(value) {
  const [h, m] = String(value).split(':');
  return `${String(h).padStart(2, '0')}:${String(m || '00').padStart(2, '0')}`;
}
