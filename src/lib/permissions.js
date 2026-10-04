export const NAV_PERMISSIONS = [
  { key: 'agenda.ver', label: 'Agenda', to: '/' },
  { key: 'turnos.ver', label: 'Turnos', to: '/turnos' },
  { key: 'pacientes.ver', label: 'Pacientes', to: '/pacientes' },
  { key: 'profesionales.ver', label: 'Profesionales', to: '/profesionales' },
  { key: 'servicios.ver', label: 'Servicios', to: '/servicios' },
  { key: 'usuarios.ver', label: 'Usuarios', to: '/usuarios' },
  { key: 'configuracion.ver', label: 'Configuración', to: '/configuracion' },
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
  const match = NAV_PERMISSIONS.find((mod) => can(user, mod.key));
  return match?.to || '/login';
}
