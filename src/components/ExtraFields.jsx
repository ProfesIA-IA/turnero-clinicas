import { useEffect, useState } from 'react';
import { api } from '../api';

export default function ExtraFields({ entity, value, onChange }) {
  const [fields, setFields] = useState([]);

  useEffect(() => {
    api.extraFields(`?entity=${entity}`).then((res) => setFields(res.data || [])).catch(() => setFields([]));
  }, [entity]);

  if (!fields.length) return null;
  const current = value && typeof value === 'object' ? value : {};

  return (
    <div className="grid gap-3">
      {fields.map((field) => {
        const key = String(field.id);
        const stored = current[key] ?? '';
        const set = (next) => onChange({ ...current, [key]: next });
        return (
          <label className="field" key={field.id}>
            <span>
              {field.label}
              {field.required ? '' : ' (opcional)'}
            </span>
            {field.field_type === 'textarea' ? (
              <textarea rows={2} value={stored} required={field.required} onChange={(e) => set(e.target.value)} />
            ) : field.field_type === 'select' ? (
              <select value={stored} required={field.required} onChange={(e) => set(e.target.value)}>
                <option value="">Elegir…</option>
                {(field.options || []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : field.field_type === 'checkbox' ? (
              <input type="checkbox" checked={Boolean(stored)} onChange={(e) => set(e.target.checked)} />
            ) : (
              <input
                type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                value={stored}
                required={field.required}
                onChange={(e) => set(e.target.value)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
