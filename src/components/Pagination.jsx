import { useEffect, useState } from 'react';

export function usePaged(items, { pageSize = 8, resetKey } = {}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  return {
    page: current,
    pages,
    total: items.length,
    pageSize,
    items: items.slice((current - 1) * pageSize, current * pageSize),
    setPage,
  };
}

export function Pager({ page, pages, total, pageSize, onPage }) {
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[#70757a]">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex gap-2">
        <button className="pill-btn disabled:opacity-40" type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </button>
        <span className="grid h-9 min-w-16 place-items-center">
          {page} / {pages}
        </span>
        <button className="pill-btn disabled:opacity-40" type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
