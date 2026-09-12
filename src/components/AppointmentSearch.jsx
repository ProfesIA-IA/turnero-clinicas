import { useMemo, useState } from 'react';
import { ymd } from '../lib/calendar';
import { appointmentLabel } from '../lib/clinical';

export default function AppointmentSearch({ appointments = [], tz, value, onChange }) {
  const [date, setDate] = useState('');
  const [service, setService] = useState('');
  const [professional, setProfessional] = useState('');

  const filtered = useMemo(() => {
    const serviceQ = normalize(service);
    const professionalQ = normalize(professional);
    return appointments.filter((item) => {
      if (date && ymd(new Date(item.starts_at), tz) !== date) return false;
      if (serviceQ && !normalize(item.service?.name).includes(serviceQ)) return false;
      if (professionalQ && !normalize(item.professional?.name).includes(professionalQ)) return false;
      return true;
    });
  }, [appointments, date, professional, service, tz]);

  const selected = appointments.find((item) => String(item.id) === String(value));

  return (
    <div className="grid gap-2">
      <div className="text-xs font-medium uppercase tracking-wide text-[#70757a]">Turno asociado</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="field">
          <span>Fecha</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Servicio</span>
          <input
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="Nombre del servicio"
          />
        </label>
        <label className="field">
          <span>Profesional</span>
          <input
            value={professional}
            onChange={(e) => setProfessional(e.target.value)}
            placeholder="Nombre del profesional"
          />
        </label>
      </div>
      <div className="max-h-48 overflow-auto rounded-xl border border-[#dadce0]">
        <button
          type="button"
          className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#f8f9fa] ${
            !value ? 'bg-[#e8f0fe] text-[#174ea6]' : ''
          }`}
          onClick={() => onChange('')}
        >
          Sin turno asociado
        </button>
        {filtered.map((item) => {
          const active = String(item.id) === String(value);
          return (
            <button
              key={item.id}
              type="button"
              className={`block w-full border-t border-[#dadce0] px-3 py-2 text-left text-sm hover:bg-[#f8f9fa] ${
                active ? 'bg-[#e8f0fe] text-[#174ea6]' : ''
              }`}
              onClick={() => onChange(String(item.id))}
            >
              <div className="font-medium">
                {item.service?.name || 'Servicio'} · {item.professional?.name || 'Profesional'}
              </div>
              <div className="text-[#70757a]">{appointmentLabel(item, tz)}</div>
            </button>
          );
        })}
        {!filtered.length && (
          <div className="border-t border-[#dadce0] px-3 py-3 text-sm text-[#70757a]">
            No hay turnos con esos filtros.
          </div>
        )}
      </div>
      {selected && (
        <div className="rounded-lg bg-[#f8f9fa] px-3 py-2 text-sm text-[#3c4043]">
          <div className="font-medium">
            {selected.service?.name} · {selected.professional?.name}
          </div>
          <div className="text-[#70757a]">
            {appointmentLabel(selected, tz)}
            {selected.status ? ` · ${selected.status}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
