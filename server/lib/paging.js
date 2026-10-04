export function pageRequest(query, { defaultLimit = 8, max = 100 } = {}) {
  if (query.page == null || query.page === '') return null;
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || defaultLimit, 1), max);
  return { page, limit, offset: (page - 1) * limit };
}

export function likeTerm(value) {
  return `%${String(value || '').replace(/[%_]/g, '').trim()}%`;
}
