// ============================================================
//  FaceAttend EDU — QA · librería compartida (L1 API y L2 UI)
//
//  Solo lee: la base se consulta con SELECT (nunca escribe) y las
//  escrituras de prueba pasan por la API, con datos `QA-…` que se
//  desactivan al terminar (borrado lógico).
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const REVISION_DIR = path.join(ROOT, "docs", "revision");
export const RESULTS_DIR = path.join(REVISION_DIR, "resultados");

export const API = process.env.QA_API_URL ?? "http://localhost:8000/api/v1";
export const WEB = process.env.QA_WEB_URL ?? "http://localhost:8090";
const DB_CONTAINER = process.env.QA_DB_CONTAINER ?? "faceattend-postgres";

// ── Cuentas ──────────────────────────────────────────────────

export function loadAccounts() {
    const file = process.env.QA_ACCOUNTS_FILE ?? path.join(REVISION_DIR, ".cuentas.local");
    if (!existsSync(file)) return {};
    const accounts = {};
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        const text = line.trim();
        if (!text || text.startsWith("#")) continue;
        const at = text.indexOf("=");
        if (at > 0) accounts[text.slice(0, at).trim()] = text.slice(at + 1);
    }
    return accounts;
}

/** Roles de la revisión → usuario de prueba (ver 00-PROTOCOLO.md §3). */
export const ROLE_USERS = {
    SUP: "admin.faceattend",
    ADM: "fermin",
    ADM2: "admin.ict",
    DOC: "maria.sanchez",
    EST: "est.ict",
};

// ── HTTP ─────────────────────────────────────────────────────

/** Las rutas absolutas solo se aceptan si apuntan al mismo origen que la API bajo prueba. */
function resolveRoute(route) {
    if (!route.startsWith("http")) {
        // Ruta relativa: debe quedarse bajo la base de la API (sin saltos de directorio).
        if (!route.startsWith("/") || route.split("?")[0].split("/").includes("..")) {
            throw new Error(`Ruta inválida para la API de QA: ${route}`);
        }
        return `${API}${route}`;
    }
    if (new URL(route).origin !== new URL(API).origin) {
        throw new Error(`Ruta fuera del origen de la API de QA: ${route}`);
    }
    return route;
}

/** Petición a la API. Nunca lanza: devuelve { status, text, json, ms, error }. */
export async function api(method, route, { token, body, headers = {}, rawBody, timeout = 20000 } = {}) {
    const url = resolveRoute(route);
    const init = { method, headers: { ...headers }, signal: AbortSignal.timeout(timeout) };
    if (token) init.headers.Authorization = `Bearer ${token}`;
    if (rawBody !== undefined) {
        init.body = rawBody;
    } else if (body !== undefined) {
        init.headers["Content-Type"] ??= "application/json";
        init.body = JSON.stringify(body);
    }
    const started = Date.now();
    try {
        // Kong limita a 300 peticiones/min: ante un 429 se espera y se reintenta,
        // para no confundir el límite de ritmo con el resultado de la prueba.
        let response = await fetch(url, init);
        for (let attempt = 0; attempt < 4 && response.status === 429; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 3000 + attempt * 3000));
            response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
        }
        const text = await response.text();
        let json = null;
        try {
            json = text ? JSON.parse(text) : null;
        } catch {
            json = null;
        }
        return { status: response.status, text, json, ms: Date.now() - started };
    } catch (error) {
        return { status: 0, text: "", json: null, ms: Date.now() - started, error: String(error?.message ?? error) };
    }
}

const sessions = new Map();

/** Inicia sesión por API. Devuelve { token, userId } o null. */
export async function login(identifier, password) {
    const key = `${identifier}`;
    if (sessions.has(key)) return sessions.get(key);
    const res = await api("POST", "/auth/login", { body: { email: identifier, password } });
    const session = res.status === 200 && res.json?.sessionId ? { token: res.json.sessionId, userId: res.json.userId } : null;
    sessions.set(key, session);
    return session;
}

/** Lista una colección paginada (por `page` o por `offset`) con tope de páginas. */
export async function fetchAll(token, route, { by = "offset", maxPages = 30 } = {}) {
    const items = [];
    for (let i = 0; i < maxPages; i += 1) {
        const query = by === "page" ? `page=${i + 1}&limit=100` : `limit=100&offset=${i * 100}`;
        const res = await api("GET", `${route}${route.includes("?") ? "&" : "?"}${query}`, { token });
        if (res.status !== 200) return { status: res.status, items, text: res.text };
        const list = Array.isArray(res.json)
            ? res.json
            : Array.isArray(res.json?.data)
              ? res.json.data
              : Array.isArray(res.json?.content)
                ? res.json.content
                : [];
        items.push(...list);
        if (list.length < 100) break;
    }
    return { status: 200, items };
}

/** Handshake de WebSocket sin librerías: devuelve el status (101 si se aceptó). */
export function wsHandshake(route, { token, bearer } = {}) {
    return new Promise((resolve) => {
        const url = new URL(`${API}${route}`);
        const headers = {
            Connection: "Upgrade",
            Upgrade: "websocket",
            "Sec-WebSocket-Version": "13",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
        };
        // Same channel the kiosk uses: the session as a subprotocol, never in the URL.
        if (token) headers["Sec-WebSocket-Protocol"] = `faceattend.bearer, ${token}`;
        if (bearer) headers.Authorization = `Bearer ${bearer}`;
        const request = http.request(
            { host: url.hostname, port: url.port, path: `${url.pathname}${url.search}`, method: "GET", headers, timeout: 8000 },
            (response) => {
                resolve({ status: response.statusCode });
                response.resume();
                request.destroy();
            }
        );
        request.on("upgrade", (response, socket) => {
            resolve({ status: response.statusCode });
            socket.destroy();
        });
        request.on("timeout", () => {
            resolve({ status: 0, error: "timeout" });
            request.destroy();
        });
        request.on("error", (error) => resolve({ status: 0, error: String(error.message) }));
        request.end();
    });
}

// ── Base de datos (solo SELECT) ──────────────────────────────

export function sql(query) {
    if (!/^\s*(select|with)\b/i.test(query) || /;\s*\S/.test(query)) {
        throw new Error(`sql(): solo se permite un SELECT. Recibido: ${query.slice(0, 60)}`);
    }
    const out = execFileSync(
        "docker",
        ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-d", "faceattend_db", "-At", "-F", "|", "-c", query],
        { encoding: "utf8", timeout: 30000 }
    );
    return out
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => line.split("|"));
}

export const sqlOne = (query) => sql(query)[0]?.[0] ?? null;

// ── Veredictos y reporte ─────────────────────────────────────

export const VERDICT = { PASS: "PASS", FAIL: "FAIL", DUDA: "DUDA", BLOQUEADO: "BLOQUEADO" };

export function summarize(rows) {
    const count = (v) => rows.filter((r) => r.verdict === v).length;
    return {
        PASS: count("PASS"),
        FAIL: count("FAIL"),
        DUDA: count("DUDA"),
        BLOQUEADO: count("BLOQUEADO"),
    };
}

const cell = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").slice(0, 220);

/** Escribe resultados/<name>.md y .json con la tabla de verificaciones. */
export function writeReport(name, title, rows, extra = {}) {
    mkdirSync(RESULTS_DIR, { recursive: true });
    const totals = summarize(rows);
    const lines = [
        `# ${title}`,
        "",
        `- Fecha: ${new Date().toISOString()}`,
        `- Web: ${WEB} · API: ${API}`,
        ...Object.entries(extra).map(([key, value]) => `- ${key}: ${value}`),
        "",
        "| ID | Veredicto | Severidad | Rol / ruta | Petición | Evidencia | Nota |",
        "|---|---|---|---|---|---|---|",
        ...rows.map(
            (r) =>
                `| ${cell(r.id)} | ${r.verdict} | ${cell(r.severity ?? "")} | ${cell(r.who ?? "")} | ${cell(r.request ?? "")} | ${cell(r.evidence ?? "")} | ${cell(r.note ?? "")} |`
        ),
        "",
        "## Resumen",
        `${totals.PASS} PASS · ${totals.FAIL} FAIL · ${totals.DUDA} DUDA · ${totals.BLOQUEADO} BLOQUEADO`,
        "",
    ];
    writeFileSync(path.join(RESULTS_DIR, `${name}.md`), lines.join("\n"), "utf8");
    writeFileSync(path.join(RESULTS_DIR, `${name}.json`), JSON.stringify({ title, totals, rows }, null, 2), "utf8");
    return totals;
}

export const excerpt = (text, max = 120) => String(text ?? "").replace(/\s+/g, " ").slice(0, max);

export const randomId = () => Math.random().toString(36).slice(2, 8);
