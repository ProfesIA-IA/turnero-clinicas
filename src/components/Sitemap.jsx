import { NavLink, useLocation } from 'react-router-dom';

const SECTIONS = [
  { test: (path) => path === '/', to: '/', label: 'Agenda', end: true },
  { test: (path) => path.startsWith('/turnos'), to: '/turnos', label: 'Turnos' },
  { test: (path) => path.startsWith('/pacientes'), to: '/pacientes', label: 'Pacientes' },
  { test: (path) => path.startsWith('/profesionales'), to: '/profesionales', label: 'Profesionales' },
  { test: (path) => path.startsWith('/servicios'), to: '/servicios', label: 'Servicios' },
  { test: (path) => path.startsWith('/configuracion'), to: '/configuracion', label: 'Configuración' },
  { test: (path) => path.startsWith('/chatbot'), to: '/chatbot', label: 'Chatbot' },
  { test: (path) => path.startsWith('/mensajes'), to: '/mensajes', label: 'Mensajes' },
  { test: (path) => path.startsWith('/campos'), to: '/campos', label: 'Campos extra' },
];

export default function Sitemap() {
  const { pathname } = useLocation();
  const section = SECTIONS.find((item) => item.test(pathname)) || SECTIONS[0];
  const crumbs = section.to === '/' ? [SECTIONS[0]] : [SECTIONS[0], section];

  return (
    <nav className="sitemap" aria-label="Sitio">
      {crumbs.map((item, index) => (
        <span key={item.to} className="contents">
          {index > 0 && <span className="sitemap-sep">/</span>}
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sitemap-btn${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        </span>
      ))}
    </nav>
  );
}
