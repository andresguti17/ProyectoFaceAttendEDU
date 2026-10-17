import { getToken } from '../storage/TokenStorage';
import ENV from '../config/env';
import { httpErrorMessage, noSessionMessage, timeoutMessage } from './httpErrors';

const BASE_URL = ENV.API_BASE_URL;
const TIMEOUT = ENV.API_TIMEOUT;

/**
 * message: texto traducido para mostrar al usuario (httpErrors.*).
 * detail: texto técnico del backend, para logs y casos puntuales.
 */
class ApiError extends Error {
  constructor(status, message, data, detail = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.detail = detail;
  }
}

async function buildHeaders(requiresAuth) {
  const headers = { 'Content-Type': 'application/json' };

  // El token se adjunta siempre que exista: los MS exigen Bearer en /api/**
  // y requiresAuth:true además falla si no hay sesión guardada.
  const token = await getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (requiresAuth) {
    throw new ApiError(401, noSessionMessage(), null);
  }

  return headers;
}

function buildUrl(path) {
  if (path.startsWith('http')) return path;
  const canonical = canonicalizePath(path);
  const base = BASE_URL.replace(/\/+$/, '');
  return `${base}/${canonical.replace(/^\//, '')}`;
}

// ── Sesión rechazada por el backend ─────────────────────────
// El sessionId opaco caduca a las 8 h (session_timeout_minutes) aunque
// localmente no tenga expiresAt, así que la app arranca "logueada" con un
// token muerto. AppNavigator se suscribe aquí para purgar la sesión y
// volver al login en el primer 401, en vez de disparar 401 en cada llamada.
let sessionExpiredHandler = null;
let sessionExpiredNotified = false;

/** Registra el callback de sesión caducada; devuelve la función para desuscribirse. */
export function onSessionExpired(handler) {
  sessionExpiredHandler = handler;
  return () => {
    if (sessionExpiredHandler === handler) sessionExpiredHandler = null;
  };
}

/**
 * En los flujos de credenciales el 401 es una respuesta de negocio
 * (contraseña o código incorrectos), no una sesión muerta.
 */
function isCredentialFlow(url) {
  return url.includes('/api/v1/auth/');
}

/** Texto técnico del backend. FastAPI usa { detail: string | [{loc, msg}] } en lugar de { message }. */
function readErrorDetail(body) {
  if (body?.message) return body.message;
  const detail = body?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d) => `${(d?.loc ?? []).join('.') || 'field'}: ${d?.msg ?? ''}`).join('; ');
  }
  return null;
}

function notifySessionExpired() {
  // Una sola vez por sesión caída: varias llamadas fallan en paralelo.
  if (sessionExpiredNotified || !sessionExpiredHandler) return;
  sessionExpiredNotified = true;
  try {
    sessionExpiredHandler();
  } catch (e) {
    console.warn('onSessionExpired:', e?.message);
  }
}

/**
 * Mapa legacy Mobile (singular snake, sin /api/v1, contra :3000)
 * -> canónico Gateway Kong :8080 (/api/v1/plural-kebab).
 * Fuente: back-end/99-api-gateway/kong/kong.yml + controllers 01-09.
 * Los servicios Mobile siguen usando 'person', 'app_user', etc.; se
 * reescriben aquí para no tocar los 30+ services en este fix.
 */
const LEGACY_ENDPOINT_MAP = {
  person: 'api/v1/persons',
  app_user: 'api/v1/users',
  user_session: 'api/v1/sessions',
  city: 'api/v1/cities',
  role: 'api/v1/roles',
  permission: 'api/v1/permissions',
  school: 'api/v1/schools',
  program: 'api/v1/programs',
  academic_period: 'api/v1/academic-periods',
  cohort: 'api/v1/cohorts',
  course: 'api/v1/courses',
  academic_actor: 'api/v1/academic-actors',
  enrollment: 'api/v1/enrollments',
  environment: 'api/v1/environments',
  schedule_block: 'api/v1/schedule-blocks',
  class_session: 'api/v1/class-sessions',
  attendance_record: 'api/v1/attendance-records',
  justification: 'api/v1/justifications',
  justification_type: 'api/v1/justification-types',
  supporting_document: 'api/v1/supporting-documents',
  alert: 'api/v1/alerts',
  alert_type: 'api/v1/alert-types',
  biometric_update_case: 'api/v1/biometric-update-cases',
  academic_configuration: 'api/v1/academic-configurations',
  security_configuration: 'api/v1/security-configurations',
  // Auth / biométrico con path propio del gateway:
  'auth/forgot-password': 'api/v1/auth/forgot-password',
  'auth/verify-code': 'api/v1/auth/verify-code',
  'auth/reset-password': 'api/v1/auth/reset-password',
  'face/register': 'api/v1/biometric/facial/enroll',
};

function canonicalizePath(path) {
  const clean = path.replace(/^\/+/, '');
  // Ya canónico: /api/v1/... o api/v1/... -> respetar tal cual.
  if (clean.startsWith('api/v1/')) return clean;
  // Path completo legacy con slash (face/register, auth/*).
  if (LEGACY_ENDPOINT_MAP[clean]) return LEGACY_ENDPOINT_MAP[clean];
  const [head, ...rest] = clean.split('/');
  const mapped = LEGACY_ENDPOINT_MAP[head];
  if (mapped) return [mapped, ...rest].join('/');
  // Sin mapeo (p. ej. user_role sin user_id): prefijar /api/v1 para que
  // el 404 venga del gateway y evidencie el faltante de backend.
  return `api/v1/${clean}`;
}

/**
 * Reescrituras que requieren query params (no solo path):
 * - GET user_role?user_id=X -> GET api/v1/users/X/roles (contrato 02-ms-authorization)
 * - GET role?role_id=X -> GET api/v1/roles/X
 * Devuelve { url, params } ya reescritos.
 */
function rewriteUserRoleQuery(url, params) {
  if (!params || typeof params !== 'object') return { url, params };
  const clean = url.replace(/^\/+/, '');
  const head = clean.split('/')[0];
  if ((head === 'user_role' || clean.startsWith('user_role/')) && params.user_id) {
    const { user_id, ...rest } = params;
    return { url: `api/v1/users/${user_id}/roles`, params: rest };
  }
  if (head === 'role' && params.role_id && !clean.includes('/')) {
    const { role_id, ...rest } = params;
    return { url: `api/v1/roles/${role_id}`, params: rest };
  }
  return { url, params };
}

/**
 * The backend returns paginated collections as { data: [...], meta: { page, limit, total, totalPages } }
 * (fae-docs/07-api/contracts/openapi/_shared.yaml). Callers expect a plain array, so unwrap it here
 * instead of in every service.
 */
function unwrapPage(payload) {
  if (
    payload &&
    !Array.isArray(payload) &&
    Array.isArray(payload.data) &&
    payload.meta &&
    typeof payload.meta === 'object' &&
    'total' in payload.meta
  ) {
    return payload.data;
  }
  return payload;
}

// Dos pantallas pidiendo el mismo GET a la vez (p. ej. al montar en
// paralelo) no deben disparar dos viajes de red: comparten la misma
// promesa mientras está en vuelo. Se limpia al terminar (éxito o error),
// así un fallo no queda "cacheado" para la próxima petición.
const inFlightGets = new Map();

// responseType 'text' devuelve el cuerpo tal cual (p. ej. un CSV); por defecto se interpreta JSON.
export function request({ method, url, data = null, params = null, requiresAuth = true, timeoutMs = TIMEOUT, responseType = 'json' }) {
  if (method !== 'GET') {
    return performRequest({ method, url, data, params, requiresAuth, timeoutMs, responseType });
  }

  const rewritten = rewriteUserRoleQuery(url, params);
  const key = `${responseType}:${buildUrl(rewritten.url)}?${JSON.stringify(rewritten.params || {})}`;
  const pending = inFlightGets.get(key);
  if (pending) return pending;

  const promise = performRequest({ method, url, data, params, requiresAuth, timeoutMs, responseType }).finally(() => {
    inFlightGets.delete(key);
  });
  inFlightGets.set(key, promise);
  return promise;
}

async function performRequest({ method, url, data = null, params = null, requiresAuth = true, timeoutMs = TIMEOUT, responseType = 'json' }) {
  const rewritten = rewriteUserRoleQuery(url, params);
  let fullUrl = buildUrl(rewritten.url);
  params = rewritten.params;

  if (params) {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    if (query) fullUrl += `?${query}`;
  }

  const options = {
    method,
    headers: await buildHeaders(requiresAuth),
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  options.signal = controller.signal;

  try {
    const response = await fetch(fullUrl, options);
    clearTimeout(timeoutId);

    let result;
    if (responseType === 'text' && response.ok) {
      result = await response.text();
    } else {
      try {
        result = await response.json();
      } catch {
        result = null;
      }
    }

    if (!response.ok) {
      if (response.status === 401 && !isCredentialFlow(fullUrl)) {
        notifySessionExpired();
      }
      const detail = readErrorDetail(result);
      throw new ApiError(response.status, httpErrorMessage(response.status, detail), result, detail);
    }

    // Respuesta válida: rearma el aviso de sesión caducada para el próximo login.
    sessionExpiredNotified = false;
    return responseType === 'text' ? result : unwrapPage(result);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new ApiError(408, timeoutMessage(), null, `timeout calling ${BASE_URL}`);
    }
    if (error instanceof ApiError) throw error;

    // fetch failed / Network request failed / timed out en iOS: el gateway
    // Kong (:8080) está caído o el host es inalcanzable desde el dispositivo.
    throw new ApiError(0, httpErrorMessage(0), null, `${error.message || 'network error'} (${BASE_URL})`);
  }
}

export { ApiError };
export const GET = 'GET';
export const POST = 'POST';
export const PUT = 'PUT';
export const PATCH = 'PATCH';
export const DELETE = 'DELETE';
