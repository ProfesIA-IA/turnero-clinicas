import { useEffect, useState } from 'react';
import { Pager, usePaged } from '../components/Pagination';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { can } from '../lib/permissions';
import PatientForm, { emptyPatient, toPatientForm } from '../components/PatientForm';

export default function PatientsPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const paged = usePaged(rows, { resetKey: q });

  async function load(term = q) {
    const params = new URLSearchParams();
    if (term.trim()) params.set('q', term.trim());
    params.set('limit', '200');
    const res = await api.patients(`?${params.toString()}`);
    setRows(res.data);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      load(q).catch((err) => setError(err.message));
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

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
      <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f8f9fa] text-[#70757a]">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {paged.items.map((row) => (
              <tr key={row.id} className="border-t border-[#dadce0]">
                <td className="px-4 py-3 font-medium">
                  <Link className="text-[#1a73e8] hover:underline" to={`/pacientes/${row.id}`}>
                    {row.name}
                  </Link>
                </td>
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
                <td className="px-4 py-8 text-center text-[#70757a]" colSpan={4}>
                  {q.trim() ? 'No hay pacientes con ese nombre.' : 'Todavía no hay pacientes. Creá el primero.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={paged.page} pages={paged.pages} total={paged.total} pageSize={paged.pageSize} onPage={paged.setPage} />
      {editing && (
        <PatientForm
          form={editing}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            await api.savePatient(editing.id, body);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
