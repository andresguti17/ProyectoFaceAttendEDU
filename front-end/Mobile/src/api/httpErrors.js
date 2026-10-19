import i18n from '../utils/i18n';

// Códigos con mensaje propio; el resto usa el de su familia (2xx, 3xx, 4xx, 5xx).
const KNOWN = new Set([
  204, 300, 301, 302, 304, 307, 308,
  400, 401, 403, 404, 405, 408, 409, 410, 413, 415, 422, 423, 429,
  500, 501, 502, 503, 504,
]);
// En estos el detalle del backend dice qué dato corregir (validación, duplicado).
const WITH_DETAIL = new Set([400, 409, 422]);

/**
 * Mensaje traducido para el usuario según el estado HTTP. status 0 = sin
 * conexión. `detail` es el texto técnico del backend; solo se añade cuando
 * explica qué corregir.
 */
export function httpErrorMessage(status, detail) {
  let key;
  if (!status) key = 'httpErrors.network';
  else if (KNOWN.has(status)) key = `httpErrors.${status}`;
  else if (status >= 200 && status < 600) key = `httpErrors.${Math.floor(status / 100)}xx`;
  else key = 'httpErrors.unknown';
  const message = i18n.t(key);
  return WITH_DETAIL.has(status) && detail ? `${message} (${detail})` : message;
}

export const timeoutMessage = () => i18n.t('httpErrors.timeout');
export const noSessionMessage = () => i18n.t('httpErrors.noSession');
