import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { can } from '../lib/permissions';
import { useClinic } from '../clinic';
import AppointmentModal from '../components/AppointmentModal';
import { atMinutes, formatRangeLabel } from '../lib/calendar';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { Pager } from '../components/Pagination';

export default function AppointmentsPage() {
  const { professionals, services, tz } = useClinic();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const limit = 8;

  useEffect(() => {
    setPage(1);
  }, [q, status, professionalId, date]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set('status', status);
      if (professionalId) params.set('professionalId', professionalId);
      if (q.trim()) params.set('q', q.trim());
      if (date) {
        const [year, month, day] = date.split('-').map(Number);
        const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
        params.set('from', atMinutes(date, 0, tz).toISOString());
        params.set('to', atMinutes(next, 0, tz).toISOString());
      }
      api.appointments(`?${params.toString()}`)
        .then((res) => {
          setRows(res.data || []);
          setTotal(res.total || 0);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(handle);
  }, [q, status, professionalId, date, page, reloadKey, tz]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">Turnos</h1>
        <input
          className="h-9 w-full min-w-0 rounded-full border border-[#dadce0] px-4 text-sm outline-none focus:border-[#1a73e8] sm:w-auto sm:min-w-[220px]"
          placeholder="Buscar paciente o profesional…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="h-9 w-full rounded-full border border-[#dadce0] px-3 text-sm outline-none focus:border-[#1a73e8] sm:w-auto"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Filtrar por fecha"
        />
        <select className="pill-btn w-full sm:w-auto" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
          <option value="">Todos los profesionales</option>
          {professionals.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select className="pill-btn w-full sm:w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
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
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className="rounded-xl border border-[#dadce0] p-4 text-left"
            onClick={() => setSelected(row)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{row.patient?.name || 'Sin paciente'}</div>
                <div className="mt-1 text-sm capitalize text-[#70757a]">
                  {formatInTimeZone(new Date(row.starts_at), tz, "EEE d MMM", { locale: es })} · {formatRangeLabel(new Date(row.starts_at), new Date(row.ends_at), tz)}
                </div>
                <div className="mt-1 truncate text-sm text-[#3c4043]">
                  {row.professional?.name} · {row.service?.name}
                </div>
              </div>
              <StatusBadge status={row.status} />
            </div>
          </button>
        ))}
        {!rows.length && <div className="rounded-xl border border-[#dadce0] px-4 py-8 text-center text-sm text-[#70757a]">No hay turnos para estos filtros.</div>}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-[#dadce0] md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f8f9fa] text-[#70757a]">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
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
                <td className="px-4 py-3 capitalize">{formatInTimeZone(new Date(row.starts_at), tz, "EEE d MMM yyyy", { locale: es })}</td>
                <td className="px-4 py-3">{formatRangeLabel(new Date(row.starts_at), new Date(row.ends_at), tz)}</td>
                <td className="px-4 py-3">{row.patient?.name || '—'}</td>
                <td className="px-4 py-3">{row.professional?.name}</td>
                <td className="px-4 py-3">{row.service?.name}</td>
                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="px-4 py-8 text-center text-[#70757a]" colSpan={6}>
                  No hay turnos para estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / limit))} total={total} pageSize={limit} onPage={setPage} />
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
          setReloadKey((value) => value + 1);
        }}
        onCancelTurno={async (id) => {
          await api.cancelAppointment(id);
          setSelected(null);
          setReloadKey((value) => value + 1);
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
