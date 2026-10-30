/**
 * Arnés de las pruebas de contrato web ⇄ endpoint ⇄ BD contra el stack local.
 *
 * Aquí viven las piezas que comparten contract.live.test.js (escrituras) y
 * contract.read.live.test.js (lecturas): cuentas de prueba, SQL contra el contenedor de
 * PostgreSQL, un fetch con node:http (jsdom no trae fetch) que captura lo que la web
 * manda y lo que contesta el endpoint, y el registro de resultados por capa que
 * alimenta `estado-contrato.json` (lo que muestra el informe).
 *
 * Capas de cada escenario:
 *   web ⇄ endpoint  lo que la web envía contra lo que el endpoint recibe y devuelve
 *   endpoint ⇄ BD   lo que el endpoint devuelve contra la fila que queda en PostgreSQL
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";

export const LIVE = process.env.LIVE_CONTRACT === "1";
export const ROOT = path.resolve(__dirname, "../../../../../../..");
export const API = process.env.QA_GATEWAY_URL ?? "http://localhost:8000";
const PG_CONTAINER = process.env.QA_PG_CONTAINER ?? "faceattend-postgres";
export const REPORT_FILE = path.join(ROOT, "estado-contrato.json");

export const rid = Math.random().toString(36).slice(2, 8).toUpperCase();
export const pick = (o, ...keys) => keys.map((k) => o?.[k]).find((v) => v !== undefined && v !== null);
export const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

// ── cuentas ──────────────────────────────────────────────────

/** ADM=correo:clave en .cuentas.qa; usuario=clave en .cuentas.local. */
export function readCredentials(file, key) {
    const p = path.join(ROOT, file);
    if (!existsSync(p)) return null;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
        if (!line || line.startsWith("#")) continue;
        const [k, ...rest] = line.split("=");
        if (k.trim() !== key) continue;
        const value = rest.join("=").trim();
        if (key === "ADM") {
            const i = value.indexOf(":");
            return { identifier: value.slice(0, i), password: value.slice(i + 1) };
        }
        return { identifier: key, password: value };
    }
    return null;
}

// ── PostgreSQL (docker exec psql) ────────────────────────────

function psql(statement, flags) {
    return execFileSync(
        "docker",
        ["exec", "-e", "Q", PG_CONTAINER, "sh", "-c", `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" ${flags} -c "$Q"`],
        { env: { ...process.env, Q: statement }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
}
/** Filas como JSON, sin depender del formato de psql. */
export const sql = (query) => JSON.parse(psql(`select coalesce(json_agg(t), '[]') from (${query}) t`, "-At").trim());
export const one = (query) => sql(query)[0] ?? null;
export const exec = (statement) => { psql(statement, "-q"); };

// ── fetch con captura ────────────────────────────────────────

// jsdom no trae fetch: este lo sustituye con node:http (solo lo que usa apiClient: status, ok, text).
function nodeFetch(url, init = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, { method: init.method ?? "GET", headers: init.headers }, (res) => {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
                const text = Buffer.concat(chunks).toString("utf8");
                resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, text: async () => text });
            });
        });
        req.on("error", reject);
        init.signal?.addEventListener("abort", () => req.destroy(new Error("aborted")));
        if (init.body) req.write(init.body);
        req.end();
    });
}

const wire = [];
export const lastWire = () => wire[wire.length - 1];

export function installFetchSpy() {
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        const res = await nodeFetch(url, init);
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* sin JSON */ }
        wire.push({
            method: init.method ?? "GET",
            url: String(url),
            request: init.body ? JSON.parse(init.body) : undefined,
            status: res.status,
            response: json,
        });
        return res;
    };
    return () => { globalThis.fetch = real; };
}

/** Prepara el cliente de la web contra el stack local. Devuelve la función que lo deshace. */
export function bootWeb() {
    process.env.EXPO_PUBLIC_SESSION_MODE = "bearer";
    window.__FACEATTEND_API_URL__ = API;
    return installFetchSpy();
}

/** Inicia sesión con el servicio de la web y guarda el token como lo hace AuthContext. */
export async function loginAs(creds) {
    const { authApi } = require("../authApi");
    const { saveToken, clearToken } = require("../../../api/apiClient");
    await clearToken();
    const session = await authApi.login({ email: creds.identifier, password: creds.password });
    const sessionId = pick(session, "sessionId", "session_id", "id");
    if (!sessionId) throw new Error("login sin sessionId");
    await saveToken(String(sessionId), { email: creds.identifier });
    return session;
}

// ── registro de resultados por capa ──────────────────────────

const rows = [];

/**
 * Registra un escenario como test. `fn(L)` cambia `L.layer = "bd"` cuando pasa de comparar
 * la petición con el endpoint a comparar el endpoint con la base de datos; si algo falla,
 * la capa activa queda en FAIL (y la siguiente sin comprobar). `L.note` añade el detalle
 * que se verá en el informe.
 */
export function scenario(group, op, fn) {
    test(op, async () => {
        const L = { layer: "web", note: "" };
        try {
            await fn(L);
        } catch (e) {
            const failedWeb = L.layer === "web";
            rows.push({ group, op, web: failedWeb ? "FAIL" : "PASS", bd: failedWeb ? "OMITIDO" : "FAIL", note: `${L.note ? L.note + " " : ""}Falló: ${String(e?.message ?? e).split("\n")[0].slice(0, 220)}` });
            throw e;
        }
        rows.push({ group, op, web: "PASS", bd: "PASS", note: L.note });
    });
}

/** Marca una operación cuya corrección ya está en la rama pero no en develop. */
export function recordKnown(group, op, web, bd, note) {
    rows.push({ group, op, web, bd, note });
}

/** Mezcla los resultados de este archivo con los del otro en estado-contrato.json. */
export function flushReport(source) {
    if (!LIVE || !rows.length) return;
    let current = { rows: [] };
    try { current = JSON.parse(readFileSync(REPORT_FILE, "utf8")); } catch { /* primera corrida */ }
    const keep = (current.rows ?? []).filter((r) => r.source !== source);
    const mine = rows.map((r) => ({ ...r, source }));
    writeFileSync(
        REPORT_FILE,
        JSON.stringify({ generatedAt: new Date().toISOString(), cmd: "node verificar-contrato.mjs", rows: [...keep, ...mine] }, null, 2)
    );
}
