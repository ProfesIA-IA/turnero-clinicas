import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const FIELD_TYPES = [
  { id: 'text', label: 'Texto' },
  { id: 'textarea', label: 'Texto largo' },
  { id: 'number', label: 'Número' },
  { id: 'date', label: 'Fecha' },
  { id: 'select', label: 'Lista' },
  { id: 'checkbox', label: 'Sí / No' },
];

export default function ClinicalFieldsSettings({ professionals, services }) {
  const [fields, setFields] = useState([]);
  const [error, setError] = useState('');
  const grouped = useMemo(() => {
    const byOwner = { service: {}, professional: {} };
    for (const field of fields) {
      const bucket = byOwner[field.owner_type] || {};
      bucket[field.owner_id] ||= [];
      bucket[field.owner_id].push(field);
      byOwner[field.owner_type] = bucket;
    }
    return byOwner;
  }, [fields]);

  async function load() {
    const res = await api.clinicalFields();
    setFields(res.data || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  return (
    <section className="mt-10 max-w-4xl space-y-5">
      <div>
        <h2 className="text-xl">Campos de historia clínica</h2>
        <p className="mt-1 text-sm text-[#70757a]">
          Además de los detalles y archivos, cada servicio o profesional puede tener campos propios. Se muestran al
          cargar una entrada según el turno elegido.
        </p>
      </div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <OwnerGroup
        title="Por servicio"
        owners={services}
        fieldsByOwner={grouped.service}
        ownerType="service"
        onChange={load}
        onError={setError}
      />
      <OwnerGroup
        title="Por profesional"
        owners={professionals}
        fieldsByOwner={grouped.professional}
        ownerType="professional"
        onChange={load}
        onError={setError}
      />
    </section>
  );
}

function OwnerGroup({ title, owners, fieldsByOwner, ownerType, onChange, onError }) {
  return (
    <div className="grid gap-3">
      <h3 className="text-base font-medium">{title}</h3>
      {owners.map((owner) => (
        <div key={owner.id} className="rounded-xl border border-[#dadce0] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="mr-auto font-medium">{owner.name}</div>
            <button
              type="button"
              className="pill-btn"
              onClick={async () => {
                try {
                  await api.saveClinicalField(null, {
                    ownerType,
                    ownerId: owner.id,
                    label: 'Nuevo campo',
                    fieldType: 'text',
                    sortOrder: (fieldsByOwner[owner.id] || []).length,
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
            {(fieldsByOwner[owner.id] || []).map((field) => (
              <FieldRow key={field.id} field={field} onChange={onChange} onError={onError} />
            ))}
            {!(fieldsByOwner[owner.id] || []).length && (
              <div className="text-sm text-[#70757a]">Sin campos extra. Se usan solo detalles y archivos.</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldRow({ field, onChange, onError }) {
  const [state, setState] = useState(toState(field));
  useEffect(() => setState(toState(field)), [field]);

  async function save(next = state) {
    try {
      await api.saveClinicalField(field.id, {
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
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
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
            await api.deleteClinicalField(field.id);
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
  const options = Array.isArray(field.options) ? field.options.join(', ') : '';
  return {
    label: field.label || '',
    fieldType: field.field_type || 'text',
    required: Boolean(field.required),
    options,
  };
}
