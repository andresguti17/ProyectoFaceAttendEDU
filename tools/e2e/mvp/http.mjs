// Cliente HTTP de los flujos E2E del MVP: todo pasa por Kong, como en las apps.
// Node >= 20, sin dependencias. Nunca imprime contraseñas ni ids de sesión.

import { randomBytes, randomInt } from "node:crypto";

// Sin regex: `/\/+$/` retrocede de forma super-lineal (Sonar S8786).
export function trimTrailingSlashes(url) {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end -= 1;
  return url.slice(0, end);
}

export const API = trimTrailingSlashes(process.env.API_URL || "http://localhost:8000") + "/api/v1";
export const WEB_ORIGIN = trimTrailingSlashes(process.env.WEB_ORIGIN || "http://localhost:8090");

// IDs del servidor en la ruta (S7044/S8476).
export const seg = (value) => encodeURIComponent(String(value));

// identity.password_policy: 8-20 caracteres con mayúscula, número y símbolo.
export const secret = () => `E2e${randomBytes(7).toString("hex")}#7`;
export const runId = () => randomBytes(3).toString("hex");
export const docNumber = () => String(randomInt(1_000_000_000, 9_999_999_999));

export class HttpError extends Error {
  constructor(label, res) {
    super(`${label}: HTTP ${res.status} ${res.text.slice(0, 300)}`);
    this.status = res.status;
  }
}

/** Una petición a Kong. `token` va como Bearer; `headers` se suman (cookie, origen...). */
export async function call(method, route, { token, json, form, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    h["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(`${API}${route}`, { method, headers: h, body, signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // cuerpo que no es JSON (p. ej. un 204 o una página de error de Kong)
  }
  return { status: res.status, json: data, text, headers: res.headers };
}

/** Como `call`, pero exige uno de los códigos `ok` y devuelve el cuerpo JSON. */
export async function must(label, method, route, opts = {}, ok = [200, 201]) {
  const res = await call(method, route, opts);
  if (!ok.includes(res.status)) throw new HttpError(label, res);
  return res.json;
}

export function expectStatus(label, res, expected) {
  const list = Array.isArray(expected) ? expected : [expected];
  if (!list.includes(res.status)) throw new HttpError(`${label} (se esperaba ${list.join("/")})`, res);
}

export function check(label, condition, detail = "") {
  if (!condition) throw new Error(`${label}${detail ? `: ${detail}` : ""}`);
}

export const pick = (o, ...keys) => keys.map((k) => o?.[k]).find((v) => v !== undefined && v !== null);
export const items = (json) => (Array.isArray(json) ? json : json?.data ?? json?.content ?? json?.items ?? []);

export async function login(identifier, password, headers) {
  return call("POST", "/auth/login", { json: { identifier, password }, headers });
}

/** Login que debe salir bien; devuelve { token, userId, mustChangePassword }. */
export async function session(identifier, password) {
  const res = await login(identifier, password);
  expectStatus(`login de ${identifier}`, res, 200);
  const token = res.json?.sessionId;
  check(`login de ${identifier}`, Boolean(token), "sin sessionId (¿2FA activo?)");
  return { token, userId: res.json.userId, mustChangePassword: res.json.mustChangePassword === true };
}

/** Espera hasta que `probe` devuelva algo distinto de null/false o se acabe el tiempo. */
export async function waitFor(label, probe, { timeoutMs = 90_000, everyMs = 2_000 } = {}) {
  const until = Date.now() + timeoutMs;
  let last;
  while (Date.now() < until) {
    last = await probe();
    if (last) return last;
    await new Promise((r) => setTimeout(r, everyMs));
  }
  throw new Error(`${label}: no ocurrió en ${Math.round(timeoutMs / 1000)} s`);
}

/** Fecha local de hoy (YYYY-MM-DD) y su día ISO (1 = lunes ... 7 = domingo). */
export function today() {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return { date: iso, dayOfWeek: now.getDay() === 0 ? 7 : now.getDay() };
}
