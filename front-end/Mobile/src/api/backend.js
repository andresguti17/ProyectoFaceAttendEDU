import { request, GET } from './apiClient';

// Typed access to the real microservices through the Kong gateway
// (API_BASE_URL / AUTHZ_BASE_URL / ... all alias the gateway :8000;
// Kong routes by path, so the service base only matters for overrides).
function toSnakeKey(key) {
  return String(key)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

export function toSnakeDeep(value) {
  if (Array.isArray(value)) return value.map(toSnakeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[toSnakeKey(k)] = toSnakeDeep(v);
    return out;
  }
  return value;
}

const AUDIT_KEYS = new Set(["created_at", "updated_at", "deleted_at", "created_by", "updated_by", "deleted_by", "row_version"]);

/**
 * Cuerpo para los MS Java/TS (hablan camelCase y descartan llaves snake):
 * snake -> camel, sin campos de auditoría ni null/undefined (zod los rechaza).
 */
export function toCamelBody(value) {
  const out = {};
  for (const [k, v] of Object.entries(value || {})) {
    if (AUDIT_KEYS.has(k) || v === null || v === undefined) continue;
    out[k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}

export function asList(data) {
  const norm = toSnakeDeep(data);
  if (Array.isArray(norm)) return norm;
  if (norm && typeof norm === 'object') {
    if (Array.isArray(norm.data)) return norm.data;
    if (Array.isArray(norm.items)) return norm.items;
    const singleArray = Object.values(norm).find((v) => Array.isArray(v));
    if (singleArray) return singleArray;
    // Servicios Go devuelven {"alerts": null} en colecciones vacías:
    // no es un objeto único, es lista vacía.
    if (Object.values(norm).every((v) => v === null || v === undefined)) return [];
    return [norm];
  }
  return [];
}

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(base, path, params) {
  return `${base}${path}?${JSON.stringify(params || {})}`;
}

// Todo pasa por el gateway Kong (:8000), que exige Bearer en /api/**.
// El token se guarda en login (TokenStorage) y apiClient lo adjunta.
export async function backendGet(base, path, params = null, { useCache = false } = {}) {
  const key = cacheKey(base, path, params);
  if (useCache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  }
  const data = await request({ method: GET, url: `${base}${path}`, params, requiresAuth: true });
  const list = asList(data);
  if (useCache) cache.set(key, { at: Date.now(), value: list });
  return list;
}

export function clearBackendCache() {
  cache.clear();
}
