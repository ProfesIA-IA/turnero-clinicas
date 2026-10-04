export const MODULES = [
  { key: 'agenda', label: 'Agenda', to: '/' },
  { key: 'turnos', label: 'Turnos', to: '/turnos' },
  { key: 'pacientes', label: 'Pacientes', to: '/pacientes' },
  { key: 'profesionales', label: 'Profesionales', to: '/profesionales' },
  { key: 'servicios', label: 'Servicios', to: '/servicios' },
  { key: 'configuracion', label: 'Configuración', to: '/configuracion' },
  { key: 'usuarios', label: 'Usuarios', to: '/usuarios' },
];

export const ROLE_LABELS = {
  admin: 'Administrador',
  secretaria: 'Secretaría',
  profesional: 'Profesional',
  paciente: 'Paciente',
};

export function can(user, key) {
  if (!user) return false;
  if (user.role === 'admin' || user.isSystem) return true;
  return Boolean(user.permissions?.[key]);
}

export function firstAllowedPath(user) {
  const match = MODULES.find((mod) => can(user, mod.key));
  return match?.to || '/login';
}
