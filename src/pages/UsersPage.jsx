import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { can, ROLE_LABELS } from '../lib/permissions';
import { useAuth } from '../auth';
import { EntityPhoto, PhotoField } from '../components/PhotoField';
import { Pager, usePaged } from '../components/Pagination';
import ExtraFields from '../components/ExtraFields';

const EMPTY = {
  username: '',
  email: '',
  name: '',
  password: '',
  sendPasswordLink: false,
  sendPassword: false,
  role: 'secretaria',
  active: true,
  professionalId: '',
  patientId: '',
  permissions: {},
  extra: {},
};

export default function UsersPage() {
  const { user: current } = useAuth();
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [patients, setPatients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const paged = usePaged(users);

  async function load() {
    const [userRes, metaRes, proRes, patientRes] = await Promise.all([
      api.users(),
      api.usersMeta(),
      api.professionals().catch(() => ({ data: [] })),
      api.patients('?limit=200').catch(() => ({ data: [] })),
    ]);
    setUsers(userRes.data);
    setMeta(metaRes);
    setProfessionals(proRes.data || []);
    setPatients(patientRes.data || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl">Usuarios</h1>
          <p className="text-sm text-[#70757a]">Altas de secretaría, profesionales y pacientes, con permisos por sección.</p>
        </div>
        {can(current, 'usuarios.crear') && (
          <button
            className="pill-btn primary"
            type="button"
            onClick={() => setEditing({ ...EMPTY, permissions: { ...(meta?.defaults?.secretaria || {}) } })}
          >
            Nuevo usuario
          </button>
        )}
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid gap-3">
        {paged.items.map((user) => (
          <div key={user.id} className="flex flex-col gap-3 rounded-xl border border-[#dadce0] p-4 sm:flex-row sm:items-center">
            <EntityPhoto
              kind="users"
              id={user.id}
              hasPhoto={user.hasPhoto}
              fallback={<span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8f0fe] text-sm font-medium text-[#1a73e8]">{user.name?.[0] || '?'}</span>}
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {user.name}{' '}
                <span className="text-sm font-normal text-[#70757a]">@{user.username}</span>
              </div>
              <div className="text-sm text-[#70757a]">
                {user.email || 'Sin email'} · {ROLE_LABELS[user.role] || user.role}
                {user.isSystem ? ' · cuenta del sistema' : ''}
                {!user.active ? ' · desactivado' : ''}
              </div>
            </div>
            {!user.isSystem && (
              <div className="flex gap-2">
                {can(current, 'usuarios.editar') && (
                  <button className="pill-btn" type="button" onClick={() => setEditing(toForm(user))}>
                    Editar
                  </button>
                )}
                {can(current, 'usuarios.eliminar') && (
                  <button
                    className="pill-btn"
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`¿Eliminar a ${user.name}?`)) return;
                      await api.deleteUser(user.id);
                      await load();
                    }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <Pager page={paged.page} pages={paged.pages} total={paged.total} pageSize={paged.pageSize} onPage={paged.setPage} />
      {editing && meta && (
        <UserForm
          form={editing}
          meta={meta}
          professionals={professionals}
          patients={patients}
          onClose={() => setEditing(null)}
          onSave={async (body, photo) => {
            const saved = await api.saveUser(editing.id, body);
            if (photo) await api.uploadPhoto('users', saved.data.id, photo);
            await load();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function toForm(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email || '',
    name: user.name,
    sendPasswordLink: false,
    sendPassword: false,
    password: '',
    role: user.role,
    active: user.active,
    professionalId: user.professionalId || '',
    patientId: user.patientId || '',
    permissions: { ...user.permissions },
    extra: user.extra || {},
    hasPhoto: user.hasPhoto,
  };
}

function UserForm({ form, meta, professionals, patients, onClose, onSave }) {
  const [state, setState] = useState(form);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const permissions = meta.permissions || [];
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return permissions;
    return permissions.filter((item) => `${item.group} ${item.label}`.toLowerCase().includes(term));
  }, [permissions, query]);
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of visible) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group).push(item);
    }
    return [...map.entries()];
  }, [visible]);

  function setRole(role) {
    setState((prev) => ({
      ...prev,
      role,
      permissions: { ...(meta.defaults[role] || {}) },
    }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card max-h-[90vh] overflow-auto"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          setError('');
          try {
            await onSave({
              username: state.username,
              email: state.email,
              name: state.name,
              password: state.password,
              sendPasswordLink: state.sendPasswordLink,
              sendPassword: state.sendPassword,
              role: state.role,
              active: state.active,
              professionalId: state.professionalId || null,
              patientId: state.patientId || null,
              permissions: state.permissions,
              extra: state.extra || {},
            }, photo);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <div className="border-b border-[#dadce0] px-5 py-4 text-lg">{state.id ? 'Editar usuario' : 'Nuevo usuario'}</div>
        <div className="grid gap-3 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <PhotoField kind="users" id={state.id} hasPhoto={form.hasPhoto} file={photo} onFile={setPhoto} />
          <label className="field">
            <span>Nombre</span>
            <input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} required />
          </label>
          <label className="field">
            <span>Usuario</span>
            <input value={state.username} onChange={(e) => setState({ ...state, username: e.target.value })} required />
          </label>
          <label className="field">
            <span>Email (opcional, recomendado)</span>
            <input
              type="email"
              value={state.email}
              onChange={(e) => setState({ ...state, email: e.target.value })}
              placeholder="Para recuperar la contraseña y avisos de turnos"
            />
          </label>
          <label className="field">
            <span>{state.id ? 'Nueva contraseña' : 'Contraseña'}</span>
            <input
              type="password"
              value={state.password}
              onChange={(e) => setState({ ...state, password: e.target.value })}
              required={!state.id && !state.email}
              minLength={state.password ? 6 : undefined}
              placeholder={state.id ? 'Dejar vacío para no cambiarla' : 'O enviá un enlace al email'}
            />
          </label>
          {state.email && (
            <div className="grid gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.sendPassword}
                  onChange={(e) => setState({ ...state, sendPassword: e.target.checked, sendPasswordLink: e.target.checked ? false : state.sendPasswordLink })}
                />
                Enviar la contraseña por email
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.sendPasswordLink || (!state.id && !state.password && !state.sendPassword)}
                  onChange={(e) => setState({ ...state, sendPasswordLink: e.target.checked, sendPassword: e.target.checked ? false : state.sendPassword })}
                />
                Enviar enlace para definir la contraseña
              </label>
            </div>
          )}
          <label className="field">
            <span>Rol</span>
            <select value={state.role} onChange={(e) => setRole(e.target.value)}>
              {meta.roles.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          {state.role === 'profesional' && (
            <RecordSearch
              label="Profesional"
              placeholder="Buscar profesional…"
              value={state.professionalId}
              options={professionals}
              onChange={(id) => setState({ ...state, professionalId: id })}
            />
          )}
          {state.role === 'paciente' && (
            <RecordSearch
              label="Paciente"
              placeholder="Buscar paciente…"
              value={state.patientId}
              options={patients}
              onSearch={async (term) => {
                const params = new URLSearchParams({ limit: '30' });
                if (term.trim()) params.set('q', term.trim());
                const res = await api.patients(`?${params.toString()}`);
                setPatients(res.data || []);
              }}
              onChange={(id) => setState({ ...state, patientId: id })}
            />
          )}
          <ExtraFields entity="user" value={state.extra} onChange={(extra) => setState({ ...state, extra })} />
          <div className="field">
            <span>Permisos</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar permiso…"
            />
            <div className="mt-2 max-h-64 space-y-3 overflow-auto rounded-lg border border-[#dadce0] p-3">
              {groups.length === 0 && <div className="text-sm text-[#70757a]">Ningún permiso coincide.</div>}
              {groups.map(([group, items]) => (
                <div key={group}>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[#70757a]">{group}</div>
                  <div className="grid gap-1">
                    {items.map((item) => (
                      <label key={item.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(state.permissions[item.key])}
                          onChange={(e) =>
                            setState({
                              ...state,
                              permissions: { ...state.permissions, [item.key]: e.target.checked },
                            })
                          }
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.active}
              onChange={(e) => setState({ ...state, active: e.target.checked })}
            />
            Activo
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#dadce0] px-5 py-4">
          <button className="pill-btn" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="pill-btn primary" type="submit">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

function RecordSearch({ label, placeholder, value, options, onChange, onSearch }) {
  const [term, setTerm] = useState('');
  const selected = options.find((item) => String(item.id) === String(value));
  const shown = options.filter((item) => item.name.toLowerCase().includes(term.trim().toLowerCase()));

  useEffect(() => {
    if (!onSearch) return undefined;
    const handle = setTimeout(() => {
      onSearch(term).catch(() => {});
    }, 200);
    return () => clearTimeout(handle);
  }, [term]);

  return (
    <div className="field">
      <span>{label}</span>
      <input
        value={term}
        placeholder={selected ? selected.name : placeholder}
        onChange={(e) => setTerm(e.target.value)}
      />
      <input className="sr-only" tabIndex={-1} value={value || ''} required onChange={() => {}} />
      {selected && !term && <div className="text-sm text-[#174ea6]">{selected.name}</div>}
      <div className="max-h-40 overflow-auto rounded-lg border border-[#dadce0]">
        {shown.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#f8f9fa] ${String(item.id) === String(value) ? 'bg-[#e8f0fe]' : ''}`}
            onClick={() => {
              onChange(String(item.id));
              setTerm('');
            }}
          >
            {item.name}
          </button>
        ))}
        {!shown.length && <div className="px-3 py-2 text-sm text-[#70757a]">Sin resultados</div>}
      </div>
    </div>
  );
}
