const DEFAULTS = [
  { key: 'name', label: 'Nombre', type: 'text', enabled: true, required: true },
  { key: 'phone', label: 'Teléfono', type: 'tel', enabled: true, required: true },
  { key: 'email', label: 'Email', type: 'email', enabled: true, required: false },
  { key: 'notes', label: 'Notas', type: 'text', enabled: false, required: false },
];

export function bookingFields(raw) {
  const saved = Array.isArray(raw) ? raw : [];
  return DEFAULTS.map((field) => {
    const match = saved.find((item) => item?.key === field.key) || {};
    const enabled = field.key === 'name' ? true : Boolean(match.enabled ?? field.enabled);
    const required = field.key === 'name' ? true : enabled && Boolean(match.required ?? field.required);
    return { ...field, enabled, required };
  });
}

export function patientFromBooking(body, fields) {
  const patient = { name: '', phone: '', email: '', notes: '' };
  for (const field of fields) {
    if (!field.enabled) continue;
    const value = String(body?.[field.key] || '').trim();
    if (field.required && !value) {
      const error = new Error(`${field.label} es obligatorio`);
      error.status = 400;
      throw error;
    }
    if (field.key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      const error = new Error('El email no es válido');
      error.status = 400;
      throw error;
    }
    patient[field.key] = value;
  }
  return patient;
}
