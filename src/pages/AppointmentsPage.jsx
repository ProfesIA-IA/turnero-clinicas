import { useEffect, useState } from 'react';
import { api } from '../api';
import { useClinic } from '../clinic';
import AppointmentModal from '../components/AppointmentModal';
import { formatRangeLabel } from '../lib/calendar';

export default function AppointmentsPage() {
  const { professionals, services, tz } = useClinic();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [selected, setSelected] = useState(null);

  async function load() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (professionalId) params.set('professionalId', professionalId);
    const res = await api.appointments(`?${params.toString()}`);
    setRows(res.data);
  }

  useEffect(() => {
    load().catch(() => {});
  }, [status, professionalId]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">Turnos</h1>
        <select className="pill-btn" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
          <option value="">Todos los profesionales</option>
          {professionals.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select className="pill-btn" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="RESERVADO">Reservado</option>
          <option value="CONFIRMADO">Confirmado</option>
          <option value="COMPLETADO">Completado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <button className="pill-btn primary" onClick={() => setSelected('new')}>
          Nuevo turno
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f8f9fa] text-[#70757a]">
            <tr>
              <th className="px-4 py-3 font-medium">Horario</th>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Profesional</th>
              <th className="px-4 py-3 font-medium">Servicio</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-t border-[#dadce0] hover:bg-[#f8f9fa]"
                onClick={() => setSelected(row)}
              >
                <td className="px-4 py-3">{formatRangeLabel(new Date(row.starts_at), new Date(row.ends_at), tz)}</td>
                <td className="px-4 py-3">{row.patient?.name || '—'}</td>
                <td className="px-4 py-3">{row.professional?.name}</td>
                <td className="px-4 py-3">{row.service?.name}</td>
                <td className="px-4 py-3">{row.status}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="px-4 py-8 text-center text-[#70757a]" colSpan={5}>
                  No hay turnos para estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AppointmentModal
        open={Boolean(selected)}
        appointment={selected && selected !== 'new' ? selected : null}
        professionals={professionals}
        services={services}
        tz={tz}
        onClose={() => setSelected(null)}
        onSave={async (payload) => {
          await api.saveAppointment(payload.id, payload);
          setSelected(null);
          await load();
        }}
        onCancelTurno={async (id) => {
          await api.cancelAppointment(id);
          setSelected(null);
          await load();
        }}
      />
    </div>
  );
}
