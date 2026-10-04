import { appointmentLabel } from '../lib/clinical';

export default function AppointmentSearch({ appointments = [], tz, value, onChange }) {
  const selected = appointments.find((item) => String(item.id) === String(value));

  return (
    <div className="grid gap-2">
      <div className="text-xs font-medium uppercase tracking-wide text-[#70757a]">Turno asociado</div>
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
        {appointments.map((item) => {
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
        {!appointments.length && (
          <div className="border-t border-[#dadce0] px-3 py-3 text-sm text-[#70757a]">
            No hay turnos para asociar.
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
