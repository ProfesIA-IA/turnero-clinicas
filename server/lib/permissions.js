export const PERMISSIONS = [
  { key: 'agenda.ver', group: 'Agenda', label: 'Ver la agenda' },
  { key: 'agenda.crear_turno', group: 'Agenda', label: 'Crear turnos desde la agenda' },
  { key: 'agenda.editar_turno', group: 'Agenda', label: 'Editar turnos desde la agenda' },
  { key: 'agenda.cancelar_turno', group: 'Agenda', label: 'Cancelar turnos desde la agenda' },
  { key: 'agenda.eliminar_turno', group: 'Agenda', label: 'Eliminar turnos desde la agenda' },
  { key: 'agenda.crear_bloqueo', group: 'Agenda', label: 'Crear bloqueos de horario' },
  { key: 'agenda.editar_bloqueo', group: 'Agenda', label: 'Editar bloqueos de horario' },
  { key: 'agenda.eliminar_bloqueo', group: 'Agenda', label: 'Eliminar bloqueos de horario' },
  { key: 'turnos.ver', group: 'Turnos', label: 'Ver el listado de turnos' },
  { key: 'turnos.crear', group: 'Turnos', label: 'Crear turnos' },
  { key: 'turnos.editar', group: 'Turnos', label: 'Editar turnos' },
  { key: 'turnos.cancelar', group: 'Turnos', label: 'Cancelar turnos' },
  { key: 'turnos.eliminar', group: 'Turnos', label: 'Eliminar turnos' },
  { key: 'pacientes.ver', group: 'Pacientes', label: 'Ver pacientes' },
  { key: 'pacientes.crear', group: 'Pacientes', label: 'Crear pacientes' },
  { key: 'pacientes.editar', group: 'Pacientes', label: 'Editar pacientes' },
  { key: 'pacientes.eliminar', group: 'Pacientes', label: 'Eliminar pacientes' },
  { key: 'historia.ver', group: 'Historia clínica', label: 'Ver historia clínica' },
  { key: 'historia.crear', group: 'Historia clínica', label: 'Agregar notas clínicas' },
  { key: 'historia.editar', group: 'Historia clínica', label: 'Editar notas clínicas' },
  { key: 'historia.eliminar', group: 'Historia clínica', label: 'Eliminar notas clínicas' },
  { key: 'historia.exportar', group: 'Historia clínica', label: 'Exportar historia clínica' },
  { key: 'historia.adjuntar', group: 'Historia clínica', label: 'Adjuntar archivos' },
  { key: 'historia.eliminar_archivo', group: 'Historia clínica', label: 'Eliminar archivos' },
  { key: 'profesionales.ver', group: 'Profesionales', label: 'Ver profesionales' },
  { key: 'profesionales.crear', group: 'Profesionales', label: 'Crear profesionales' },
  { key: 'profesionales.editar', group: 'Profesionales', label: 'Editar profesionales' },
  { key: 'profesionales.eliminar', group: 'Profesionales', label: 'Eliminar profesionales' },
  { key: 'profesionales.editar_horarios', group: 'Profesionales', label: 'Editar horarios de atención' },
  { key: 'profesionales.compartir', group: 'Profesionales', label: 'Compartir link de reserva' },
  { key: 'servicios.ver', group: 'Servicios', label: 'Ver servicios' },
  { key: 'servicios.crear', group: 'Servicios', label: 'Crear servicios' },
  { key: 'servicios.editar', group: 'Servicios', label: 'Editar servicios' },
  { key: 'servicios.eliminar', group: 'Servicios', label: 'Eliminar servicios' },
  { key: 'servicios.compartir', group: 'Servicios', label: 'Compartir link de reserva' },
  { key: 'configuracion.ver', group: 'Configuración', label: 'Ver configuración de la clínica' },
  { key: 'configuracion.editar', group: 'Configuración', label: 'Editar datos de la clínica' },
  { key: 'configuracion.editar_campos', group: 'Configuración', label: 'Crear y editar campos clínicos' },
  { key: 'configuracion.eliminar_campos', group: 'Configuración', label: 'Eliminar campos clínicos' },
  { key: 'usuarios.ver', group: 'Usuarios', label: 'Ver usuarios' },
  { key: 'usuarios.crear', group: 'Usuarios', label: 'Crear usuarios' },
  { key: 'usuarios.editar', group: 'Usuarios', label: 'Editar usuarios y permisos' },
  { key: 'usuarios.eliminar', group: 'Usuarios', label: 'Eliminar usuarios' },
];

const LEGACY_MODULES = {
  agenda: PERMISSIONS.filter((item) => item.key.startsWith('agenda.')).map((item) => item.key),
  turnos: PERMISSIONS.filter((item) => item.key.startsWith('turnos.')).map((item) => item.key),
  pacientes: [
    ...PERMISSIONS.filter((item) => item.key.startsWith('pacientes.')).map((item) => item.key),
    ...PERMISSIONS.filter((item) => item.key.startsWith('historia.')).map((item) => item.key),
  ],
  profesionales: PERMISSIONS.filter((item) => item.key.startsWith('profesionales.')).map((item) => item.key),
  servicios: PERMISSIONS.filter((item) => item.key.startsWith('servicios.')).map((item) => item.key),
  configuracion: PERMISSIONS.filter((item) => item.key.startsWith('configuracion.')).map((item) => item.key),
  usuarios: PERMISSIONS.filter((item) => item.key.startsWith('usuarios.')).map((item) => item.key),
};

export const ROLES = [
  { key: 'secretaria', label: 'Secretaría' },
  { key: 'profesional', label: 'Profesional' },
  { key: 'paciente', label: 'Paciente' },
];

const SECRETARIA = PERMISSIONS.filter((item) => !item.key.startsWith('configuracion.') && !item.key.startsWith('usuarios.')).map((item) => item.key);
const PROFESIONAL = [
  'agenda.ver',
  'agenda.crear_turno',
  'agenda.editar_turno',
  'agenda.cancelar_turno',
  'agenda.crear_bloqueo',
  'agenda.editar_bloqueo',
  'turnos.ver',
  'turnos.crear',
  'turnos.editar',
  'turnos.cancelar',
  'pacientes.ver',
  'pacientes.crear',
  'pacientes.editar',
  'historia.ver',
  'historia.crear',
  'historia.editar',
  'historia.adjuntar',
];
const PACIENTE = ['agenda.ver', 'turnos.ver'];

export const ROLE_DEFAULTS = {
  secretaria: SECRETARIA,
  profesional: PROFESIONAL,
  paciente: PACIENTE,
  admin: PERMISSIONS.map((item) => item.key),
};

export function defaultsFor(role) {
  return flags(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.secretaria);
}

export function expandPermissions(input) {
  const source = input && typeof input === 'object' ? input : {};
  const out = flags([]);
  for (const [moduleKey, keys] of Object.entries(LEGACY_MODULES)) {
    if (source[moduleKey] === true) {
      for (const key of keys) out[key] = true;
    }
  }
  for (const perm of PERMISSIONS) {
    if (source[perm.key] === true) out[perm.key] = true;
    if (source[perm.key] === false) out[perm.key] = false;
  }
  return out;
}

export function normalizePermissions(_role, input) {
  if (!input || typeof input !== 'object' || !Object.keys(input).length) return defaultsFor(_role);
  return expandPermissions(input);
}

function flags(keys) {
  const out = {};
  for (const perm of PERMISSIONS) out[perm.key] = keys.includes(perm.key);
  return out;
}

export function recordScope(user) {
  if (!user || user.role === 'admin' || user.isSystem) return null;
  if (user.role === 'paciente') return { patientId: Number(user.patientId) || 0 };
  if (user.role === 'profesional') return { professionalId: Number(user.professionalId) || 0 };
  return null;
}

export function hasPermission(user, key) {
  if (!user || user.active === false) return false;
  if (user.role === 'admin' || user.isSystem) return true;
  return Boolean(user.permissions?.[key]);
}

export function requireAny(...keys) {
  return (req, res, next) => {
    if (keys.some((key) => hasPermission(req.user, key))) return next();
    return res.status(403).json({ error: 'No tenés permiso para esta acción' });
  };
}

export function requireByMethod(map) {
  return (req, res, next) => {
    const spec = map[req.method];
    const keys = typeof spec === 'function' ? spec(req) : spec;
    if (!keys?.length) return res.status(403).json({ error: 'No tenés permiso para esta acción' });
    if (keys.some((key) => hasPermission(req.user, key))) return next();
    return res.status(403).json({ error: 'No tenés permiso para esta acción' });
  };
}
