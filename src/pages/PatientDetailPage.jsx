import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Paperclip } from 'lucide-react';
import { api, getToken } from '../api';
import { useClinic } from '../clinic';
import { formatCustomValue, noteHeading, noteMetaLine, visibleCustomValues } from '../lib/clinical';
import PatientForm, { toPatientForm } from '../components/PatientForm';
import ClinicalNoteForm from '../components/ClinicalNoteForm';

export default function PatientDetailPage() {
  const { id } = useParams();
  const { professionals, services, tz } = useClinic();
  const [patient, setPatient] = useState(null);
  const [notes, setNotes] = useState([]);
  const [editingPatient, setEditingPatient] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  async function load() {
    const [patientRes, notesRes] = await Promise.all([api.patient(id), api.clinicalNotes(id)]);
    setPatient(patientRes.data);
    setNotes(notesRes.data || []);
    return notesRes.data || [];
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  if (!patient) {
    return <div className="p-6 text-[#70757a]">{error || 'Cargando…'}</div>;
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-2xl">{patient.name}</h1>
          <div className="text-sm text-[#70757a]">
            {patient.phone || 'Sin teléfono'}
            {patient.email ? ` · ${patient.email}` : ''}
          </div>
        </div>
        <button className="pill-btn" onClick={() => setEditingPatient(toPatientForm(patient))}>
          Editar
        </button>
        <button
          className="pill-btn"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            try {
              await api.exportClinicalHistory(patient.id);
            } catch (err) {
              setError(err.message);
            } finally {
              setDownloading(false);
            }
          }}
        >
          {downloading ? 'Descargando…' : 'Descargar historia'}
        </button>
        <button className="pill-btn primary" onClick={() => setEditingNote({})}>
          Nueva entrada
        </button>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {patient.notes && (
        <p className="mb-5 max-w-3xl text-sm text-[#70757a]">{patient.notes}</p>
      )}
      <h2 className="mb-3 text-lg">Historia clínica</h2>
      <div className="grid gap-3">
        {notes.map((note) => (
          <article key={note.id} className="rounded-xl border border-[#dadce0] p-4">
            <div className="mb-3 flex flex-wrap items-start gap-2">
              <div className="mr-auto min-w-0">
                <div className="font-medium">{noteHeading(note)}</div>
                <div className="text-sm text-[#70757a]">{noteMetaLine(note, tz)}</div>
              </div>
              <button className="pill-btn" onClick={() => setEditingNote(note)}>
                Editar
              </button>
              <button
                className="pill-btn"
                onClick={async () => {
                  if (!confirm('¿Eliminar esta entrada?')) return;
                  await api.deleteClinicalNote(note.id);
                  await load();
                }}
              >
                Eliminar
              </button>
            </div>
            {note.details && <p className="whitespace-pre-wrap text-sm">{note.details}</p>}
            {visibleCustomValues(note).length > 0 && (
              <dl className="mt-3 grid gap-1 text-sm">
                {visibleCustomValues(note).map((item) => (
                    <div key={`${item.id}-${item.label}`} className="flex gap-2">
                      <dt className="text-[#70757a]">{item.label}:</dt>
                      <dd>{formatCustomValue(item)}</dd>
                    </div>
                  ))}
              </dl>
            )}
            {note.files?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {note.files.map((file) => (
                  <ClinicalFileLink key={file.id} file={file} />
                ))}
              </div>
            )}
          </article>
        ))}
        {!notes.length && (
          <div className="rounded-xl border border-dashed border-[#dadce0] px-4 py-10 text-center text-[#70757a]">
            Todavía no hay entradas. Creá la primera con el turno, los detalles y archivos si hace falta.
          </div>
        )}
      </div>
      {editingPatient && (
        <PatientForm
          form={editingPatient}
          onClose={() => setEditingPatient(null)}
          onSave={async (body) => {
            await api.savePatient(patient.id, body);
            setEditingPatient(null);
            await load();
          }}
        />
      )}
      {editingNote && (
        <ClinicalNoteForm
          patientId={patient.id}
          appointments={patient.appointments || []}
          professionals={professionals}
          services={services}
          note={editingNote.id ? editingNote : null}
          tz={tz}
          onClose={() => setEditingNote(null)}
          onSaved={async (close = true) => {
            const nextNotes = await load();
            if (close) setEditingNote(null);
            else if (editingNote?.id) {
              setEditingNote(nextNotes.find((item) => item.id === editingNote.id) || editingNote);
            }
          }}
        />
      )}
    </div>
  );
}

function ClinicalFileLink({ file }) {
  const isImage = String(file.mime_type || '').startsWith('image/');
  async function openFile() {
    const res = await fetch(`/api/clinical/files/${file.id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('No se pudo abrir el archivo');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
  }
  return (
    <button
      type="button"
      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[#dadce0] px-3 py-2 text-left text-sm hover:bg-[#f8f9fa]"
      onClick={() => openFile().catch(() => {})}
    >
      {isImage ? <FileText size={14} /> : <Paperclip size={14} />}
      <span className="truncate">{file.original_name}</span>
    </button>
  );
}
