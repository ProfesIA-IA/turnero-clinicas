export function extraObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (item == null || item === '') continue;
    out[String(key)] = item;
  }
  return out;
}
