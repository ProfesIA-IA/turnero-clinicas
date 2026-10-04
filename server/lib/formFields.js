const GROUPS = {
  patient: [
    { key: 'name', label: 'Nombre', locked: true },
    { key: 'dni', label: 'DNI' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'email', label: 'Email' },
    { key: 'notes', label: 'Notas' },
  ],
  professional: [
    { key: 'name', label: 'Nombre', locked: true },
    { key: 'code', label: 'Código' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono' },
  ],
  service: [
    { key: 'name', label: 'Nombre', locked: true },
    { key: 'code', label: 'Código' },
    { key: 'durationMin', label: 'Duración (min)' },
    { key: 'price', label: 'Precio' },
  ],
};

export function formFields(raw) {
  const saved = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const [entity, defaults] of Object.entries(GROUPS)) {
    const rows = Array.isArray(saved[entity]) ? saved[entity] : [];
    out[entity] = defaults.map((field) => {
      const match = rows.find((item) => item?.key === field.key) || {};
      return {
        key: field.key,
        label: String(match.label || field.label).trim() || field.label,
        locked: Boolean(field.locked),
        enabled: field.locked ? true : match.enabled !== false,
        required: field.locked ? true : match.enabled !== false && Boolean(match.required),
      };
    });
  }
  return out;
}
