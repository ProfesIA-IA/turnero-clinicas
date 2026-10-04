const BUILTINS = [
  { key: 'name', label: 'Nombre', type: 'text', enabled: true, required: true, locked: true },
  { key: 'dni', label: 'DNI', type: 'text', enabled: true, required: true, locked: true },
  { key: 'phone', label: 'Teléfono', type: 'tel', enabled: true, required: true },
  { key: 'email', label: 'Email', type: 'email', enabled: true, required: false },
  { key: 'notes', label: 'Notas', type: 'textarea', enabled: false, required: false },
];

const TYPES = new Set(['text', 'textarea', 'email', 'tel', 'number', 'select', 'checkbox']);

export function bookingFields(raw) {
  const saved = Array.isArray(raw) ? raw : [];
  const builtins = BUILTINS.map((field) => {
    const match = saved.find((item) => item?.key === field.key) || {};
    const enabled = field.locked ? true : match.enabled !== false && (match.enabled ?? field.enabled);
    const required = field.locked ? true : Boolean(enabled && (match.required ?? field.required));
    return {
      ...field,
      label: String(match.label || field.label).trim() || field.label,
      enabled,
      required,
    };
  });
  const custom = saved
    .filter((item) => item?.key && !BUILTINS.some((field) => field.key === item.key))
    .map((item, index) => {
      const type = TYPES.has(item.type) ? item.type : 'text';
      const options = Array.isArray(item.options)
        ? item.options.map((option) => String(option).trim()).filter(Boolean)
        : String(item.options || '').split(',').map((option) => option.trim()).filter(Boolean);
      return {
        key: String(item.key),
        label: String(item.label || `Campo ${index + 1}`).trim() || `Campo ${index + 1}`,
        type,
        enabled: item.enabled !== false,
        required: item.enabled !== false && Boolean(item.required),
        options,
        custom: true,
      };
    });
  return [...builtins, ...custom];
}

export function patientFromBooking(body, fields) {
  const patient = { name: '', dni: '', phone: '', email: '', notes: '' };
  const extras = [];
  for (const field of fields) {
    if (!field.enabled) continue;
    const raw = body?.[field.key];
    const value = field.type === 'checkbox' ? (raw ? 'Sí' : '') : String(raw || '').trim();
    if (field.required && !value) {
      const error = new Error(`${field.label} es obligatorio`);
      error.status = 400;
      throw error;
    }
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      const error = new Error('El email no es válido');
      error.status = 400;
      throw error;
    }
    if (field.key === 'name' || field.key === 'dni' || field.key === 'phone' || field.key === 'email') patient[field.key] = value;
    else if (field.key === 'notes') patient.notes = value;
    else if (value) extras.push(`${field.label}: ${value}`);
  }
  if (extras.length) patient.notes = [patient.notes, ...extras].filter(Boolean).join('\n');
  return patient;
}
