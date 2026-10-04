import { useEffect, useState } from 'react';
import { Pager } from '../components/Pagination';
import { Share2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { can } from '../lib/permissions';
import { useClinic } from '../clinic';
import ShareDialog from '../components/ShareDialog';
import { EntityPhoto, PhotoField } from '../components/PhotoField';
import ExtraFields from '../components/ExtraFields';
import { formFieldsOf } from '../lib/formFields';

const COLORS = ['#0b8043', '#1a73e8', '#e37400', '#d50000', '#9334e6', '#039be5'];

export default function ServicesPage() {
  const { services, professionals, reload } = useClinic();
  const { user } = useAuth();
  const [editing, setEditing] = useState(null);
  const [shareItem, setShareItem] = useState(null);
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
      api.services(`?${params.toString()}`)
        .then((res) => {
          setRows(res.data || []);
          setTotal(res.total || 0);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(handle);
  }, [q, page, reloadKey]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">Servicios</h1>
        <input
          className="h-9 w-full min-w-0 rounded-full border border-[#dadce0] px-4 text-sm outline-none focus:border-[#1a73e8] sm:w-auto sm:min-w-[240px]"
          placeholder="Buscar por nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {can(user, 'servicios.crear') && (
          <button className="pill-btn primary" onClick={() => setEditing(emptyService())}>
            Nuevo servicio
          </button>
        )}
      </div>
      <div className="grid gap-3">
        {rows.map((service) => (
          <div key={service.id} className="flex flex-col gap-3 rounded-xl border border-[#dadce0] p-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <EntityPhoto
                kind="services"
                id={service.id}
                hasPhoto={Boolean(service.photo)}
                className="h-10 w-10 rounded-lg"
                fallback={<span className="h-10 w-10 shrink-0 rounded-lg" style={{ background: service.color }} />}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{service.name}</div>
                <div className="truncate text-sm text-[#70757a]">
                  {service.duration_min} min
                  {service.price ? ` · $${Number(service.price).toLocaleString('es-AR')}` : ''} ·{' '}
                  {service.professionals?.map((p) => p.name).join(', ') || 'Sin profesionales'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {can(user, 'servicios.compartir') && (
                <button className="pill-btn inline-flex items-center gap-1" onClick={() => setShareItem(service)}>
                  <Share2 size={14} /> Compartir
                </button>
              )}
              {can(user, 'servicios.editar') && (
                <button className="pill-btn" onClick={() => setEditing(toForm(service))}>
                  Editar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / limit))} total={total} pageSize={limit} onPage={setPage} />
      {editing && (
        <ServiceForm
          form={editing}
          professionals={professionals}
          onClose={() => setEditing(null)}
          onSave={async (body, photo) => {
            const saved = await api.saveService(editing.id, body);
            if (photo) await api.uploadPhoto('services', saved.data.id, photo);
            await reload();
            setReloadKey((value) => value + 1);
            setEditing(null);
          }}
        />
      )}
      <ShareDialog
        open={Boolean(shareItem)}
        kind="servicio"
        item={shareItem}
        onClose={() => setShareItem(null)}
        onRotate={async () => {
          const res = await api.shareService(shareItem.id, true);
          setShareItem(res.data);
          await reload();
        }}
      />
    </div>
  );
}

function ServiceForm({ form, professionals, onClose, onSave }) {
  const { settings } = useClinic();
  const fields = Object.fromEntries(formFieldsOf(settings, 'service').map((field) => [field.key, field]));
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
              durationMin: Number(state.durationMin),
              color: state.color,
              price: state.price ? Number(state.price) : null,
              active: true,
              shareEnabled: true,
              professionalIds: state.professionalIds,
              extra: state.extra || {},
            }, photo);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <div className="border-b border-[#dadce0] px-5 py-4 text-lg">{state.id ? 'Editar servicio' : 'Nuevo servicio'}</div>
        <div className="grid gap-3 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <PhotoField kind="services" id={state.id} hasPhoto={Boolean(form.photo)} file={photo} onFile={setPhoto} />
          {fields.name?.enabled && <label className="field"><span>{fields.name.label}</span><input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} required /></label>}
          <div className="grid grid-cols-2 gap-3">
            {fields.code?.enabled && <label className="field"><span>{fields.code.label}</span><input value={state.code} onChange={(e) => setState({ ...state, code: e.target.value })} required={fields.code.required} /></label>}
            {fields.durationMin?.enabled && <label className="field"><span>{fields.durationMin.label}</span><input type="number" min="5" step="5" value={state.durationMin} onChange={(e) => setState({ ...state, durationMin: e.target.value })} required={fields.durationMin.required} /></label>}
          </div>
          {fields.price?.enabled && <label className="field"><span>{fields.price.label}</span><input type="number" value={state.price} onChange={(e) => setState({ ...state, price: e.target.value })} required={fields.price.required} /></label>}
          <div className="field">
            <span>Color</span>
            <div className="flex gap-2">
              {COLORS.map((color) => (
                <button key={color} type="button" className={`h-6 w-6 rounded-full ${state.color === color ? 'ring-2 ring-offset-2 ring-black/40' : ''}`} style={{ background: color }} onClick={() => setState({ ...state, color })} />
              ))}
            </div>
          </div>
          <div className="field">
            <span>Profesionales que lo atienden</span>
            <div className="flex flex-wrap gap-2">
              {professionals.map((pro) => {
                const checked = state.professionalIds.includes(pro.id);
                return (
                  <label key={pro.id} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${checked ? 'border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]' : 'border-[#dadce0]'}`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={checked}
                      onChange={() =>
                        setState({
                          ...state,
                          professionalIds: checked
                            ? state.professionalIds.filter((id) => id !== pro.id)
                            : [...state.professionalIds, pro.id],
                        })
                      }
                    />
                    {pro.name}
                  </label>
                );
              })}
            </div>
          </div>
          <ExtraFields entity="service" value={state.extra} onChange={(extra) => setState({ ...state, extra })} />
        </div>
        <div className="flex justify-end gap-2 border-t border-[#dadce0] px-5 py-3">
          <button type="button" className="pill-btn" onClick={onClose}>Cerrar</button>
          <button type="submit" className="pill-btn primary">Guardar</button>
        </div>
      </form>
    </div>
  );
}

function emptyService() {
  return { id: null, name: '', code: '', durationMin: 30, color: '#0b8043', price: '', professionalIds: [], extra: {} };
}

function toForm(service) {
  return {
    id: service.id,
    name: service.name,
    code: service.code || '',
    durationMin: service.duration_min,
    color: service.color,
    price: service.price || '',
    professionalIds: (service.professionals || []).map((p) => p.id),
    photo: service.photo || '',
    extra: service.extra || {},
  };
}
