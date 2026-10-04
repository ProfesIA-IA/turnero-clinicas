import { useEffect, useState } from 'react';
import { api } from '../api';
import { useClinic } from '../clinic';
import ClinicalFieldsSettings from '../components/ClinicalFieldsSettings';

const ENTITIES = [
  { id: 'patient', label: 'Pacientes' },
  { id: 'professional', label: 'Profesionales' },
  { id: 'service', label: 'Servicios' },
  { id: 'user', label: 'Usuarios' },
];

const FIELD_TYPES = [
  { id: 'text', label: 'Texto' },
  { id: 'textarea', label: 'Texto largo' },
  { id: 'number', label: 'Número' },
  { id: 'date', label: 'Fecha' },
  { id: 'select', label: 'Lista' },
  { id: 'checkbox', label: 'Sí / No' },
];

export default function CamposPage() {
  const { professionals, services } = useClinic();
  const [fields, setFields] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    const res = await api.extraFields();
    setFields(res.data || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <h1 className="text-2xl">Campos extra</h1>
      <p className="mt-1 mb-6 max-w-3xl text-sm text-[#70757a]">
        Campos propios para pacientes, profesionales, servicios y usuarios. Se completan al crear o editar cada uno.
      </p>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid max-w-4xl gap-6">
        {ENTITIES.map((entity) => (
          <EntityFields
            key={entity.id}
            entity={entity}
            fields={fields.filter((field) => field.entity === entity.id)}
            onChange={load}
            onError={setError}
          />
        ))}
      </div>
      <ClinicalFieldsSettings professionals={professionals} services={services} />
    </div>
  );
}

function EntityFields({ entity, fields, onChange, onError }) {
  return (
    <section className="rounded-xl border border-[#dadce0] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-medium">{entity.label}</h2>
        <button
          type="button"
          className="pill-btn"
          onClick={async () => {
            try {
              await api.saveExtraField(null, {
                entity: entity.id,
                label: 'Nuevo campo',
                fieldType: 'text',
                sortOrder: fields.length,
              });
              await onChange();
            } catch (err) {
              onError(err.message);
            }
          }}
        >
          Agregar campo
        </button>
      </div>
      <div className="grid gap-2">
        {fields.map((field) => (
          <FieldRow key={field.id} field={field} onChange={onChange} onError={onError} />
        ))}
        {!fields.length && <div className="text-sm text-[#70757a]">Sin campos extra.</div>}
      </div>
    </section>
  );
}

function FieldRow({ field, onChange, onError }) {
  const [state, setState] = useState(toState(field));
  useEffect(() => setState(toState(field)), [field]);

  async function save(next = state) {
    try {
      await api.saveExtraField(field.id, {
        label: next.label,
        fieldType: next.fieldType,
        options: next.options,
        required: next.required,
        sortOrder: field.sort_order,
      });
      await onChange();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#f8f9fa] p-3">
      <input
        className="min-w-[160px] flex-1 rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm"
        value={state.label}
        onChange={(e) => setState({ ...state, label: e.target.value })}
        onBlur={() => save()}
      />
      <select
        className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm"
        value={state.fieldType}
        onChange={(e) => {
          const next = { ...state, fieldType: e.target.value };
          setState(next);
          save(next);
        }}
      >
        {FIELD_TYPES.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.required}
          onChange={(e) => {
            const next = { ...state, required: e.target.checked };
            setState(next);
            save(next);
          }}
        />
        Obligatorio
      </label>
      {state.fieldType === 'select' && (
        <input
          className="min-w-[180px] flex-1 rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm"
          placeholder="Opciones, separadas por coma"
          value={state.options}
          onChange={(e) => setState({ ...state, options: e.target.value })}
          onBlur={() => save()}
        />
      )}
      <button
        type="button"
        className="ml-auto text-sm text-red-600"
        onClick={async () => {
          try {
            await api.deleteExtraField(field.id);
            await onChange();
          } catch (err) {
            onError(err.message);
          }
        }}
      >
        Quitar
      </button>
    </div>
  );
}

function toState(field) {
  return {
    label: field.label || '',
    fieldType: field.field_type || 'text',
    required: Boolean(field.required),
    options: Array.isArray(field.options) ? field.options.join(', ') : '',
  };
}
