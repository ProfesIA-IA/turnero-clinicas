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

export function formFieldsOf(settings, entity) {
  const saved = Array.isArray(settings?.form_fields?.[entity]) ? settings.form_fields[entity] : [];
  return (GROUPS[entity] || []).map((field) => {
    const match = saved.find((item) => item.key === field.key) || {};
    const enabled = field.locked ? true : match.enabled !== false;
    return {
      ...field,
      label: match.label || field.label,
      enabled,
      required: field.locked ? true : enabled && Boolean(match.required),
    };
  });
}
