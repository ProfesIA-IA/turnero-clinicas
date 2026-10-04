import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { PhotoField } from '../components/PhotoField';

function fromUser(user) {
  return {
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
    currentPassword: '',
  };
}

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState(() => fromUser(user));
  const [photo, setPhoto] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setForm(fromUser(user));
  }, [user]);

  if (!user) return null;

  const locked = Boolean(user.isSystem);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <h1 className="mb-1 text-2xl">Mi perfil</h1>
      <p className="mb-4 text-sm text-[#70757a]">
        {locked
          ? 'La cuenta de administrador se define en el servidor. Estos datos son solo de consulta.'
          : 'Foto, contraseña y datos de tu cuenta.'}
      </p>
      <form
        className="max-w-xl space-y-4"
        autoComplete="off"
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (locked) return;
          setError('');
          try {
            await api.saveProfile({
              name: form.name,
              email: form.email,
              phone: form.phone,
              password: form.password,
              currentPassword: form.currentPassword,
            });
            if (photo) await api.uploadMyPhoto(photo);
            setPhoto(null);
            await refresh();
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {saved && <div className="rounded-lg bg-[#e6f4ea] px-3 py-2 text-sm text-[#0b8043]">Perfil actualizado</div>}
        <PhotoField src="/api/auth/me/photo" hasPhoto={user.hasPhoto} file={photo} onFile={setPhoto} readOnly={locked} />
        <label className="field">
          <span>Nombre</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={locked} />
        </label>
        <label className="field">
          <span>Usuario</span>
          <input value={user.username} disabled autoComplete="off" />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={locked}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Teléfono</span>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={locked} />
        </label>
        {!locked && (
          <>
            <label className="field">
              <span>Nueva contraseña</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Dejar vacío para no cambiarla"
                minLength={form.password ? 6 : undefined}
                autoComplete="new-password"
              />
            </label>
            {form.password && (
              <label className="field">
                <span>Contraseña actual</span>
                <input
                  type="password"
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                  required
                  autoComplete="new-password"
                />
              </label>
            )}
            <button className="pill-btn primary" type="submit">
              Guardar
            </button>
          </>
        )}
      </form>
    </div>
  );
}
