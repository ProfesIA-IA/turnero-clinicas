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
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import PublicBookingPage from './pages/PublicBookingPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
        <Route index element={<CalendarPage />} />
        <Route path="turnos" element={<AppointmentsPage />} />
        <Route path="pacientes" element={<PatientsPage />} />
        <Route path="pacientes/:id" element={<PatientDetailPage />} />
        <Route path="profesionales" element={<ProfessionalsPage />} />
        <Route path="profesionales/:id" element={<ProfessionalScheduleRedirect />} />
        <Route path="servicios" element={<ServicesPage />} />
        <Route path="configuracion" element={<SettingsPage />} />
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

function ProfessionalScheduleRedirect() {
  const { id } = useParams();
  return <Navigate to="/profesionales" replace state={{ scheduleId: Number(id) }} />;
}
