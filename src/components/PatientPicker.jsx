import { useEffect, useRef, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { api } from '../api';
import PatientForm, { emptyPatient } from './PatientForm';

export default function PatientPicker({ value, onChange }) {
  const [queryText, setQueryText] = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQueryText(value?.name || '');
  }, [value?.id, value?.name]);

  useEffect(() => {
    const q = queryText.trim();
    if (q.length < 2) {
      setResults([]);
      return undefined;
    }
    const handle = setTimeout(() => {
      api
        .patients(`?q=${encodeURIComponent(q)}&limit=8`)
        .then((res) => setResults(res.data || []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [queryText]);

  useEffect(() => {
    function onDocClick(ev) {
      if (!wrapRef.current?.contains(ev.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function selectPatient(patient) {
    setQueryText(patient.name);
    setOpen(false);
    onChange({
      id: patient.id,
      name: patient.name,
      phone: patient.phone || '',
      email: patient.email || '',
    });
  }

  function openCreate() {
    setOpen(false);
    setCreating(true);
  }

  return (
    <div className="relative col-span-1 sm:col-span-2" ref={wrapRef}>
      <label className="field">
        <span>Paciente</span>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1"
            value={queryText}
            placeholder="Buscar por nombre…"
            autoComplete="off"
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              const name = e.target.value;
              setQueryText(name);
              setOpen(true);
              onChange({
                id: null,
                name,
                phone: value?.phone || '',
                email: value?.email || '',
              });
            }}
            required
          />
          <button type="button" className="pill-btn shrink-0 inline-flex items-center gap-1" onClick={openCreate}>
            <UserPlus size={14} />
            Nuevo
          </button>
        </div>
      </label>
      {value?.id && (
        <div className="mt-1 text-xs text-[#70757a]">
          Seleccionado: {value.name}
          {value.phone ? ` · ${value.phone}` : ''}
        </div>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-lg">
          {results.map((patient) => (
            <button
              key={patient.id}
              type="button"
              className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[#f1f3f4]"
              onClick={() => selectPatient(patient)}
            >
              <span className="text-sm font-medium">{patient.name}</span>
              <span className="text-xs text-[#70757a]">
                {patient.phone || 'Sin teléfono'}
                {patient.email ? ` · ${patient.email}` : ''}
              </span>
            </button>
          ))}
          {queryText.trim().length >= 2 && !results.length && (
            <div className="px-3 py-2 text-sm text-[#70757a]">No hay coincidencias.</div>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 border-t border-[#dadce0] px-3 py-2 text-left text-sm text-[#1a73e8] hover:bg-[#f1f3f4]"
            onClick={openCreate}
          >
            <UserPlus size={14} />
            {queryText.trim() ? `Crear paciente “${queryText.trim()}”` : 'Crear paciente nuevo'}
          </button>
        </div>
      )}
      {creating && (
        <PatientForm
          stacked
          requirePhone
          form={emptyPatient({
            name: queryText.trim(),
            phone: value?.phone || '',
            email: value?.email || '',
          })}
          onClose={() => setCreating(false)}
          onSave={async (body) => {
            const res = await api.savePatient(null, body);
            selectPatient(res.data);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
