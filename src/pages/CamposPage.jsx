import { useEffect, useState } from 'react';
import { api } from '../api';
import { useClinic } from '../clinic';
import ClinicalFieldsSettings from '../components/ClinicalFieldsSettings';
import { formFieldsOf } from '../lib/formFields';

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
        Campos de la reserva online y de pacientes, profesionales, servicios y usuarios.
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          ['seccion-reserva', 'Reserva online'],
          ['seccion-patient', 'Pacientes'],
          ['seccion-professional', 'Profesionales'],
          ['seccion-service', 'Servicios'],
          ['seccion-user', 'Usuarios'],
          ['seccion-historia', 'Historia clínica'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="rounded-full border border-[#dadce0] bg-[#f8f9fa] px-3 py-1.5 text-sm text-[#3c4043] hover:border-[#1a73e8] hover:bg-[#e8f0fe] hover:text-[#1a73e8]"
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid max-w-4xl gap-6">
        <BookingFields />
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

const BOOKING_TYPES = [
  { id: 'text', label: 'Texto' },
  { id: 'textarea', label: 'Texto largo' },
  { id: 'email', label: 'Email' },
  { id: 'tel', label: 'Teléfono' },
  { id: 'number', label: 'Número' },
  { id: 'select', label: 'Lista' },
  { id: 'checkbox', label: 'Sí / No' },
];

function BookingFields() {
  const { settings, reload } = useClinic();
  const [fields, setFields] = useState(settings?.booking_fields || []);
  const [intro, setIntro] = useState(settings?.booking_intro || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!settings) return;
    setFields(settings.booking_fields || []);
    setIntro(settings.booking_intro || '');
  }, [settings]);

  function persist(nextFields = fields, nextIntro = intro) {
    api.saveSettings({ bookingFields: nextFields, bookingIntro: nextIntro }).then(() => reload()).catch((err) => setError(err.message));
  }

  function patch(key, next, saveNow) {
    const updated = fields.map((field) => (field.key === key ? { ...field, ...next } : field));
    setFields(updated);
    if (saveNow) persist(updated, intro);
  }

  return (
    <section id="seccion-reserva" className="scroll-mt-24 rounded-xl border border-[#dadce0] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="text-base font-medium">Reserva online</h2>
          <p className="text-sm text-[#70757a]">Qué completa la persona antes de confirmar el turno.</p>
        </div>
        <button
          type="button"
          className="pill-btn"
          onClick={() => {
            const updated = [
              ...fields,
              { key: `custom_${Date.now()}`, label: 'Nuevo campo', type: 'text', enabled: true, required: false, custom: true, options: [] },
            ];
            setFields(updated);
            persist(updated, intro);
          }}
        >
          Agregar campo
        </button>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <label className="field mb-3">
        <span>Texto de ayuda</span>
        <textarea rows={2} value={intro} placeholder="Por ejemplo: traé tu documento y llegá 10 minutos antes." onChange={(e) => setIntro(e.target.value)} onBlur={(e) => persist(fields, e.target.value)} />
      </label>
      <div className="grid gap-2">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-wrap items-center gap-2 rounded-lg bg-[#f8f9fa] p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.key === 'name' ? true : Boolean(field.enabled)}
                disabled={field.key === 'name'}
                onChange={(e) => patch(field.key, { enabled: e.target.checked, required: e.target.checked ? field.required : false }, true)}
              />
              Visible
            </label>
            <input
              className="min-w-[140px] flex-1 rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm"
              value={field.label}
              onChange={(e) => patch(field.key, { label: e.target.value })}
              onBlur={() => persist()}
            />
            {field.custom && (
              <select
                className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm"
                value={field.type}
                onChange={(e) => patch(field.key, { type: e.target.value }, true)}
              >
                {BOOKING_TYPES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.key === 'name' ? true : Boolean(field.required)}
                disabled={field.key === 'name' || !field.enabled}
                onChange={(e) => patch(field.key, { required: e.target.checked }, true)}
              />
              Obligatorio
            </label>
            {field.type === 'select' && (
              <input
                className="min-w-[160px] flex-1 rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm"
                placeholder="Opciones, separadas por coma"
                value={Array.isArray(field.options) ? field.options.join(', ') : field.options || ''}
                onChange={(e) => patch(field.key, { options: e.target.value })}
                onBlur={() => persist()}
              />
            )}
            {field.custom && (
              <button type="button" className="ml-auto text-sm text-red-600" onClick={() => {
                const updated = fields.filter((item) => item.key !== field.key);
                setFields(updated);
                persist(updated, intro);
              }}>
                Quitar
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function EntityFields({ entity, fields, onChange, onError }) {
  const { settings, reload } = useClinic();
  const builtins = ['patient', 'professional', 'service'].includes(entity.id) ? formFieldsOf(settings, entity.id) : [];

  function patchBuiltin(key, next) {
    const formFields = {
      ...(settings?.form_fields || {}),
      [entity.id]: formFieldsOf(settings, entity.id).map((field) => (field.key === key ? { ...field, ...next } : field)),
    };
    api.saveSettings({ formFields }).then(() => reload()).catch((err) => onError(err.message));
  }

  return (
    <section id={`seccion-${entity.id}`} className="scroll-mt-24 rounded-xl border border-[#dadce0] p-4">
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
        {builtins.map((field) => (
          <BuiltinRow key={field.key} field={field} onPatch={patchBuiltin} />
        ))}
        {fields.map((field) => (
          <FieldRow key={field.id} field={field} onChange={onChange} onError={onError} />
        ))}
        {!fields.length && !builtins.length && <div className="text-sm text-[#70757a]">Sin campos extra.</div>}
      </div>
    </section>
  );
}

function BuiltinRow({ field, onPatch }) {
  const [label, setLabel] = useState(field.label);
  useEffect(() => setLabel(field.label), [field.label]);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#f8f9fa] p-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={field.enabled}
          disabled={field.locked}
          onChange={(e) => onPatch(field.key, { enabled: e.target.checked, required: e.target.checked ? field.required : false })}
        />
        Visible
      </label>
      <input
        className="min-w-[140px] flex-1 rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => {
          if (label !== field.label) onPatch(field.key, { label });
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={field.required}
          disabled={field.locked || !field.enabled}
          onChange={(e) => onPatch(field.key, { required: e.target.checked })}
        />
        Obligatorio
      </label>
    </div>
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
