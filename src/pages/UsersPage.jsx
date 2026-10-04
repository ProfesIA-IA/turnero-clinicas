import { useEffect, useState } from 'react';
import { api } from '../api';
import { ROLE_LABELS } from '../lib/permissions';

const EMPTY = {
  username: '',
  name: '',
  password: '',
  role: 'secretaria',
  active: true,
  professionalId: '',
  patientId: '',
  permissions: {},
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [patients, setPatients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

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
        <button
          className="pill-btn primary"
          type="button"
          onClick={() => setEditing({ ...EMPTY, permissions: { ...(meta?.defaults?.secretaria || {}) } })}
        >
          Nuevo usuario
        </button>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid gap-3">
        {users.map((user) => (
          <div key={user.id} className="flex flex-col gap-3 rounded-xl border border-[#dadce0] p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {user.name}{' '}
                <span className="text-sm font-normal text-[#70757a]">@{user.username}</span>
              </div>
              <div className="text-sm text-[#70757a]">
                {ROLE_LABELS[user.role] || user.role}
                {user.isSystem ? ' · cuenta del sistema' : ''}
                {!user.active ? ' · desactivado' : ''}
              </div>
            </div>
            {!user.isSystem && (
              <div className="flex gap-2">
                <button className="pill-btn" type="button" onClick={() => setEditing(toForm(user))}>
                  Editar
                </button>
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
              </div>
            )}
          </div>
        ))}
      </div>
      {editing && meta && (
        <UserForm
          form={editing}
          meta={meta}
          professionals={professionals}
          patients={patients}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            await api.saveUser(editing.id, body);
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
    name: user.name,
    password: '',
    role: user.role,
    active: user.active,
    professionalId: user.professionalId || '',
    patientId: user.patientId || '',
    permissions: { ...user.permissions },
  };
}

function UserForm({ form, meta, professionals, patients, onClose, onSave }) {
  const [state, setState] = useState(form);
  const [error, setError] = useState('');

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
              name: state.name,
              password: state.password,
              role: state.role,
              active: state.active,
              professionalId: state.professionalId || null,
              patientId: state.patientId || null,
              permissions: state.permissions,
            });
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <div className="border-b border-[#dadce0] px-5 py-4 text-lg">{state.id ? 'Editar usuario' : 'Nuevo usuario'}</div>
        <div className="grid gap-3 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="field">
            <span>Nombre</span>
            <input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} required />
          </label>
          <label className="field">
            <span>Usuario</span>
            <input value={state.username} onChange={(e) => setState({ ...state, username: e.target.value })} required />
          </label>
          <label className="field">
            <span>{state.id ? 'Nueva contraseña' : 'Contraseña'}</span>
            <input
              type="password"
              value={state.password}
              onChange={(e) => setState({ ...state, password: e.target.value })}
              required={!state.id}
              minLength={state.password ? 6 : undefined}
              placeholder={state.id ? 'Dejar vacío para no cambiarla' : ''}
            />
          </label>
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
            <label className="field">
              <span>Profesional</span>
              <select
                value={state.professionalId}
                onChange={(e) => setState({ ...state, professionalId: e.target.value })}
                required
              >
                <option value="">Elegir…</option>
                {professionals.map((pro) => (
                  <option key={pro.id} value={pro.id}>
                    {pro.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {state.role === 'paciente' && (
            <label className="field">
              <span>Paciente</span>
              <select value={state.patientId} onChange={(e) => setState({ ...state, patientId: e.target.value })} required>
                <option value="">Elegir…</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="field">
            <span>Puede ver</span>
            <div className="grid gap-2 pt-1">
              {meta.modules.map((mod) => (
                <label key={mod.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(state.permissions[mod.key])}
                    onChange={(e) =>
                      setState({
                        ...state,
                        permissions: { ...state.permissions, [mod.key]: e.target.checked },
                      })
                    }
                  />
                  {mod.label}
                </label>
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
