import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { can } from '../lib/permissions';
import { useClinic } from '../clinic';
import AppointmentModal from '../components/AppointmentModal';
import { formatRangeLabel } from '../lib/calendar';

export default function AppointmentsPage() {
  const { professionals, services, tz } = useClinic();
  const { user } = useAuth();
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
        {(can(user, 'turnos.crear') || can(user, 'agenda.crear_turno')) && (
          <button className="pill-btn primary" onClick={() => setSelected('new')}>
            Nuevo turno
          </button>
        )}
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
                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
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

const STATUS_BADGE = {
  RESERVADO: { label: 'Reservado', color: '#1a73e8', tint: '#e8f0fe' },
  CONFIRMADO: { label: 'Confirmado', color: '#0b8043', tint: '#e6f4ea' },
  COMPLETADO: { label: 'Completado', color: '#5f6368', tint: '#f1f3f4' },
  CANCELADO: { label: 'Cancelado', color: '#d93025', tint: '#fce8e6' },
};

function StatusBadge({ status }) {
  const item = STATUS_BADGE[status] || { label: status, color: '#5f6368', tint: '#f1f3f4' };
  return (
    <span
      className="inline-flex h-7 items-center rounded-full px-3 text-xs font-medium"
      style={{ background: item.tint, color: item.color }}
    >
      {item.label}
    </span>
  );
}
