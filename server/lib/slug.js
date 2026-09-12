export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function uniqueSlug(base, suffix = '') {
  const clean = slugify(base) || 'calendario';
  return suffix ? `${clean}-${suffix}` : clean;
}
