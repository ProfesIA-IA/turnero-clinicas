import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import PoweredBy from '../components/PoweredBy';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.resetPassword({ token: params.get('token'), password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f8f9fa]">
      <div className="grid flex-1 place-items-center p-4">
        <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#dadce0] sm:p-8">
          <h1 className="mb-4 text-2xl text-[#3c4043]">Nueva contraseña</h1>
          {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {done ? (
            <Link to="/login" className="text-[#1a73e8]">
              Contraseña actualizada. Ingresar
            </Link>
          ) : (
            <>
              <label className="field mb-5">
                <span>Contraseña</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
              </label>
              <button type="submit" className="h-11 w-full rounded-full bg-[#1a73e8] font-medium text-white disabled:opacity-60" disabled={busy}>
                Guardar
              </button>
            </>
          )}
        </form>
      </div>
      <PoweredBy />
    </div>
  );
}
