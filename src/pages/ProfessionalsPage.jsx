import { useEffect, useState } from 'react';
import { Pager } from '../components/Pagination';
import { useLocation } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { can } from '../lib/permissions';
import { useClinic } from '../clinic';
import ShareDialog from '../components/ShareDialog';
import SchedulesModal from '../components/SchedulesModal';
import { EntityPhoto, PhotoField } from '../components/PhotoField';
import ExtraFields from '../components/ExtraFields';
import { formFieldsOf } from '../lib/formFields';

const COLORS = ['#1a73e8', '#0b8043', '#e37400', '#d50000', '#9334e6', '#039be5', '#f6bf26'];

export default function ProfessionalsPage() {
  const { professionals, services, reload } = useClinic();
  const { user } = useAuth();
  const location = useLocation();
  const [editing, setEditing] = useState(null);
  const [shareItem, setShareItem] = useState(null);
  const [schedulePro, setSchedulePro] = useState(null);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const limit = 8;

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      api.professionals(`?${params.toString()}`)
        .then((res) => {
          setRows(res.data || []);
          setTotal(res.total || 0);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(handle);
  }, [q, page, reloadKey]);

  useEffect(() => {
    const scheduleId = Number(location.state?.scheduleId);
    if (!scheduleId || !professionals.length) return;
    const pro = professionals.find((item) => Number(item.id) === scheduleId);
    if (pro) setSchedulePro(pro);
  }, [location.state, professionals]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">Profesionales</h1>
        <input
          className="h-9 w-full min-w-0 rounded-full border border-[#dadce0] px-4 text-sm outline-none focus:border-[#1a73e8] sm:w-auto sm:min-w-[240px]"
          placeholder="Buscar por nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {can(user, 'profesionales.crear') && (
          <button className="pill-btn primary" onClick={() => setEditing(emptyPro())}>
            Nuevo profesional
          </button>
        )}
      </div>
      <div className="grid gap-3">
        {rows.map((pro) => (
          <div key={pro.id} className="flex flex-col gap-3 rounded-xl border border-[#dadce0] p-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <EntityPhoto
                kind="professionals"
                id={pro.id}
                hasPhoto={Boolean(pro.photo)}
                fallback={<span className="h-10 w-10 shrink-0 rounded-full" style={{ background: pro.color }} />}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{pro.name}</div>
                <div className="truncate text-sm text-[#70757a]">
                  {pro.services?.map((s) => s.name).join(' · ') || 'Sin servicios'} · {pro.schedules?.length || 0} franjas
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {can(user, 'profesionales.editar_horarios') && (
                <button className="pill-btn" type="button" onClick={() => setSchedulePro(pro)}>
                  Horarios
                </button>
              )}
              {can(user, 'profesionales.compartir') && (
                <button
                  className="pill-btn inline-flex items-center gap-1"
                  onClick={() => setShareItem(pro)}
                  disabled={!pro.share_slug}
                >
                  <Share2 size={14} /> Compartir
                </button>
              )}
              {can(user, 'profesionales.editar') && (
                <button className="pill-btn" onClick={() => setEditing(toForm(pro))}>
                  Editar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / limit))} total={total} pageSize={limit} onPage={setPage} />
      {editing && (
        <ProfessionalForm
          form={editing}
          services={services}
          onClose={() => setEditing(null)}
          onSave={async (body, photo) => {
            const saved = await api.saveProfessional(editing.id, body);
            if (photo) await api.uploadPhoto('professionals', saved.data.id, photo);
            await reload();
            setReloadKey((value) => value + 1);
            setReloadKey((value) => value + 1);
            setEditing(null);
          }}
        />
      )}
      <ShareDialog
        open={Boolean(shareItem)}
        kind="profesional"
        item={shareItem}
        onClose={() => setShareItem(null)}
        onRotate={async () => {
          const res = await api.shareProfessional(shareItem.id, true);
          setShareItem(res.data);
          await reload();
        }}
      />
      {schedulePro && (
        <SchedulesModal
          professional={schedulePro}
          onClose={() => setSchedulePro(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function ProfessionalForm({ form, services, onClose, onSave }) {
  const { settings } = useClinic();
  const fields = Object.fromEntries(formFieldsOf(settings, 'professional').map((field) => [field.key, field]));
  const [state, setState] = useState(form);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          try {
            await onSave({
              name: state.name,
              code: state.code,
              email: state.email,
              phone: state.phone,
              color: state.color,
              bio: state.bio,
              active: state.active,
              shareEnabled: state.shareEnabled,
              serviceIds: state.serviceIds,
              extra: state.extra || {},
            }, photo);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <div className="border-b border-[#dadce0] px-5 py-4 text-lg">{state.id ? 'Editar profesional' : 'Nuevo profesional'}</div>
        <div className="grid gap-3 px-5 py-4">
          <PhotoField kind="professionals" id={state.id} hasPhoto={Boolean(form.photo)} file={photo} onFile={setPhoto} />
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {fields.name?.enabled && <label className="field"><span>{fields.name.label}</span><input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} required /></label>}
          <div className="grid grid-cols-2 gap-3">
            {fields.code?.enabled && <label className="field"><span>{fields.code.label}</span><input value={state.code} onChange={(e) => setState({ ...state, code: e.target.value })} required={fields.code.required} /></label>}
            <label className="field"><span>Color</span>
              <div className="flex gap-2 pt-2">
                {COLORS.map((color) => (
                  <button key={color} type="button" className={`h-6 w-6 rounded-full ${state.color === color ? 'ring-2 ring-offset-2 ring-black/40' : ''}`} style={{ background: color }} onClick={() => setState({ ...state, color })} />
                ))}
              </div>
            </label>
          </div>
          {fields.email?.enabled && <label className="field"><span>{fields.email.label}</span><input value={state.email} onChange={(e) => setState({ ...state, email: e.target.value })} required={fields.email.required} /></label>}
          {fields.phone?.enabled && <label className="field"><span>{fields.phone.label}</span><input value={state.phone} onChange={(e) => setState({ ...state, phone: e.target.value })} required={fields.phone.required} /></label>}
          <div className="field">
            <span>Servicios</span>
            <div className="flex flex-wrap gap-2">
              {services.map((service) => {
                const checked = state.serviceIds.includes(service.id);
                return (
                  <label key={service.id} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${checked ? 'border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]' : 'border-[#dadce0]'}`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={checked}
                      onChange={() =>
                        setState({
                          ...state,
                          serviceIds: checked
                            ? state.serviceIds.filter((id) => id !== service.id)
                            : [...state.serviceIds, service.id],
                        })
                      }
                    />
                    {service.name}
                  </label>
                );
              })}
            </div>
          </div>
          <ExtraFields entity="professional" value={state.extra} onChange={(extra) => setState({ ...state, extra })} />
        </div>
        <div className="flex justify-end gap-2 border-t border-[#dadce0] px-5 py-3">
          <button type="button" className="pill-btn" onClick={onClose}>Cerrar</button>
          <button type="submit" className="pill-btn primary">Guardar</button>
        </div>
      </form>
    </div>
  );
}

function emptyPro() {
  return { id: null, name: '', code: '', email: '', phone: '', color: '#1a73e8', bio: '', active: true, shareEnabled: true, serviceIds: [], extra: {} };
}

function toForm(pro) {
  return {
    id: pro.id,
    name: pro.name,
    code: pro.code || '',
    email: pro.email || '',
    phone: pro.phone || '',
    color: pro.color,
    bio: pro.bio || '',
    photo: pro.photo || '',
    active: pro.active,
    shareEnabled: pro.share_enabled,
    serviceIds: (pro.services || []).map((s) => s.id),
    extra: pro.extra || {},
  };
}
