export function formatClinicalWhen(value, tz) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('es-AR', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function appointmentLabel(item, tz) {
  const when = formatClinicalWhen(item?.starts_at, tz);
  const parts = [when, item?.professional?.name, item?.service?.name].filter(Boolean);
  return parts.join(' · ') || 'Turno';
}

export function visibleCustomValues(note) {
  return (note?.custom_values || []).filter((item) => item.value !== '' && item.value !== false);
}

export function formatCustomValue(item) {
  if (item.field_type === 'checkbox') return item.value ? 'Sí' : 'No';
  return String(item.value ?? '');
}

export function noteHeading(note) {
  const service = note?.service?.name || 'Atención';
  const professional = note?.professional?.name;
  return professional ? `${service} · ${professional}` : service;
}

export function noteMetaLine(note, tz) {
  const created = formatClinicalWhen(note?.created_at, tz);
  if (note?.appointment?.starts_at) {
    return `Turno ${formatClinicalWhen(note.appointment.starts_at, tz)} · Cargada ${created}`;
  }
  return created ? `Cargada ${created}` : '';
}

export function slugifyName(value) {
  return String(value || 'paciente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'paciente';
}
