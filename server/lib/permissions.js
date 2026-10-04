export const MODULES = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'turnos', label: 'Turnos' },
  { key: 'pacientes', label: 'Pacientes' },
  { key: 'profesionales', label: 'Profesionales' },
  { key: 'servicios', label: 'Servicios' },
  { key: 'configuracion', label: 'Configuración' },
  { key: 'usuarios', label: 'Usuarios' },
];

export const ROLES = [
  { key: 'secretaria', label: 'Secretaría' },
  { key: 'profesional', label: 'Profesional' },
  { key: 'paciente', label: 'Paciente' },
];

const ALL_TRUE = Object.fromEntries(MODULES.map((mod) => [mod.key, true]));

export const ROLE_DEFAULTS = {
  secretaria: {
    agenda: true,
    turnos: true,
    pacientes: true,
    profesionales: true,
    servicios: true,
    configuracion: false,
    usuarios: false,
  },
  profesional: {
    agenda: true,
    turnos: true,
    pacientes: true,
    profesionales: false,
    servicios: false,
    configuracion: false,
    usuarios: false,
  },
  paciente: {
    agenda: true,
    turnos: true,
    pacientes: false,
    profesionales: false,
    servicios: false,
    configuracion: false,
    usuarios: false,
  },
  admin: ALL_TRUE,
};

export function defaultsFor(role) {
  return { ...(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.secretaria) };
}

export function normalizePermissions(role, input) {
  const base = defaultsFor(role);
  const source = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const mod of MODULES) {
    out[mod.key] = source[mod.key] === undefined ? base[mod.key] : Boolean(source[mod.key]);
  }
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

export function requirePermission(key, { readsAlso = [] } = {}) {
  return (req, res, next) => {
    const read = req.method === 'GET' || req.method === 'HEAD';
    if (read && readsAlso.some((item) => hasPermission(req.user, item))) return next();
    if (!hasPermission(req.user, key)) {
      return res.status(403).json({ error: 'No tenés permiso para esta sección' });
    }
    next();
  };
}
