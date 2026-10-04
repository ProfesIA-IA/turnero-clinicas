import { useEffect, useState } from 'react';
import { Pager } from '../components/Pagination';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { can } from '../lib/permissions';
import PatientForm, { emptyPatient, toPatientForm } from '../components/PatientForm';

export default function PatientsPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const limit = 8;

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      api.patients(`?${params.toString()}`)
        .then((res) => {
          setRows(res.data);
          setTotal(res.total || 0);
        })
        .catch((err) => setError(err.message));
    }, 200);
    return () => clearTimeout(handle);
  }, [q, page, reloadKey]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">Pacientes</h1>
        <input
          className="h-9 w-full min-w-0 rounded-full border border-[#dadce0] px-4 text-sm outline-none focus:border-[#1a73e8] sm:w-auto sm:min-w-[240px]"
          placeholder="Buscar por nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {can(user, 'pacientes.crear') && (
          <button className="pill-btn primary" onClick={() => setEditing(emptyPatient())}>
            Nuevo paciente
          </button>
        )}
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-[#dadce0] p-4">
            <Link className="font-medium text-[#1a73e8]" to={`/pacientes/${row.id}`}>{row.name}</Link>
            <div className="mt-1 text-sm text-[#70757a]">DNI {row.dni || '—'} · {row.phone || 'Sin teléfono'}</div>
            <div className="truncate text-sm text-[#70757a]">{row.email || 'Sin email'}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="pill-btn" to={`/pacientes/${row.id}`}>Historia</Link>
              <button className="pill-btn" onClick={() => setEditing(toPatientForm(row))}>Editar</button>
            </div>
          </div>
        ))}
        {!rows.length && (
          <div className="rounded-xl border border-[#dadce0] px-4 py-8 text-center text-sm text-[#70757a]">
            {q.trim() ? 'No hay pacientes con ese nombre.' : 'Todavía no hay pacientes. Creá el primero.'}
          </div>
        )}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-[#dadce0] md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f8f9fa] text-[#70757a]">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">DNI</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[#dadce0]">
                <td className="px-4 py-3 font-medium">
                  <Link className="text-[#1a73e8] hover:underline" to={`/pacientes/${row.id}`}>
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{row.dni || '—'}</td>
                <td className="px-4 py-3">{row.phone || '—'}</td>
                <td className="px-4 py-3">{row.email || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link className="pill-btn" to={`/pacientes/${row.id}`}>
                      Historia
                    </Link>
                    <button className="pill-btn" onClick={() => setEditing(toPatientForm(row))}>
                      Editar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="px-4 py-8 text-center text-[#70757a]" colSpan={5}>
                  {q.trim() ? 'No hay pacientes con ese nombre.' : 'Todavía no hay pacientes. Creá el primero.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / limit))} total={total} pageSize={limit} onPage={setPage} />
      {editing && (
        <PatientForm
          form={editing}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            await api.savePatient(editing.id, body);
            setEditing(null);
            setPage(1);
            setReloadKey((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
