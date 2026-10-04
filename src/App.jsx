import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from './auth';
import { ClinicProvider } from './clinic';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import CalendarPage from './pages/CalendarPage';
import AppointmentsPage from './pages/AppointmentsPage';
import ProfessionalsPage from './pages/ProfessionalsPage';
import ServicesPage from './pages/ServicesPage';
import SettingsPage from './pages/SettingsPage';
import ChatbotPage from './pages/ChatbotPage';
import InboxPage from './pages/InboxPage';
import CamposPage from './pages/CamposPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import PublicBookingPage from './pages/PublicBookingPage';
import UsersPage from './pages/UsersPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage';
import { can, firstAllowedPath } from './lib/permissions';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/restablecer" element={<ResetPasswordPage />} />
      <Route path="/reservar/profesional/:slug" element={<PublicBookingPage kind="profesional" />} />
      <Route path="/reservar/servicio/:slug" element={<PublicBookingPage kind="servicio" />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <ClinicProvider>
              <Layout />
            </ClinicProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Guard perm="agenda.ver"><CalendarPage /></Guard>} />
        <Route path="turnos" element={<Guard perm="turnos.ver"><AppointmentsPage /></Guard>} />
        <Route path="pacientes" element={<Guard perm="pacientes.ver"><PatientsPage /></Guard>} />
        <Route path="pacientes/:id" element={<Guard perm="pacientes.ver"><PatientDetailPage /></Guard>} />
        <Route path="profesionales" element={<Guard perm="profesionales.ver"><ProfessionalsPage /></Guard>} />
        <Route path="profesionales/:id" element={<ProfessionalScheduleRedirect />} />
        <Route path="servicios" element={<Guard perm="servicios.ver"><ServicesPage /></Guard>} />
        <Route path="usuarios" element={<Guard perm="usuarios.ver"><UsersPage /></Guard>} />
        <Route path="configuracion" element={<Guard perm="configuracion.ver"><SettingsPage /></Guard>} />
        <Route path="chatbot" element={<Guard perm="configuracion.ver"><ChatbotPage /></Guard>} />
        <Route path="mensajes" element={<Guard perm="configuracion.ver"><InboxPage /></Guard>} />
        <Route path="campos" element={<Guard perm="configuracion.ver"><CamposPage /></Guard>} />
        <Route path="perfil" element={<ProfilePage />} />
      </Route>
    </Routes>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return <div className="grid min-h-full place-items-center text-[#70757a]">Cargando…</div>;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function Guard({ perm, children }) {
  const { user } = useAuth();
  if (!can(user, perm)) return <Navigate to={firstAllowedPath(user)} replace />;
  return children;
}

function ProfessionalScheduleRedirect() {
  const { id } = useParams();
  return <Navigate to="/profesionales" replace state={{ scheduleId: Number(id) }} />;
}
