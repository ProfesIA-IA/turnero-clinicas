import { NavLink, Outlet } from 'react-router-dom';
import {
  CalendarDays,
  Clock3,
  LogOut,
  Menu,
  Settings,
  ListPlus,
  Stethoscope,
  CircleUser,
  UserRound,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth';
import { useClinic } from '../clinic';
import { can } from '../lib/permissions';
import PoweredBy from './PoweredBy';
import Sitemap from './Sitemap';

const NAV = [
  { to: '/', label: 'Agenda', icon: CalendarDays, end: true, perm: 'agenda.ver' },
  { to: '/turnos', label: 'Turnos', icon: Clock3, perm: 'turnos.ver' },
  { to: '/pacientes', label: 'Pacientes', icon: Users, perm: 'pacientes.ver' },
  { to: '/profesionales', label: 'Profesionales', icon: UserRound, perm: 'profesionales.ver' },
  { to: '/servicios', label: 'Servicios', icon: Stethoscope, perm: 'servicios.ver' },
  { to: '/usuarios', label: 'Usuarios', icon: Shield, perm: 'usuarios.ver' },
  { to: '/configuracion', label: 'Configuración', icon: Settings, perm: 'configuracion.ver' },
  { to: '/campos', label: 'Campos extra', icon: ListPlus, perm: 'configuracion.ver' },
  { to: '/perfil', label: 'Mi perfil', icon: CircleUser },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { settings } = useClinic();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="gcal-header" style={{ display: 'flex' }}>
        <button className="icon-btn" type="button" onClick={() => setOpen(true)} aria-label="Menú">
          <Menu size={22} />
        </button>
        <div className="flex min-w-0 items-center gap-2 pr-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#1a73e8] text-sm font-semibold text-white sm:h-10 sm:w-10 sm:text-lg">
            {new Date().getDate()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg text-[#5f6368] sm:text-xl">Calendar</div>
            <div className="hidden truncate text-xs text-[#70757a] sm:block">{settings?.name || 'Turnero'}</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-[#70757a] sm:block">{user?.name || user?.username}</span>
          <button className="icon-btn" type="button" onClick={logout} title="Salir">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <Sitemap />
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <aside
            className="absolute bottom-0 left-0 top-0 w-[min(320px,90vw)] overflow-auto bg-white p-4 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-medium">Menú</div>
              <button className="icon-btn" type="button" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <nav>
              {NAV.filter((item) => !item.perm || can(user, item.perm)).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}
      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
      <PoweredBy />
    </div>
  );
}
