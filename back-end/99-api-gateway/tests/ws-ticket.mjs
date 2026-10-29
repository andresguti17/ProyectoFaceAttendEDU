// Ticket de un solo uso del WebSocket biométrico (S-10, opción A) contra el gateway real.
//
//   FAE_TEST_USER=<usuario> FAE_TEST_PASSWORD=<contraseña> node back-end/99-api-gateway/tests/ws-ticket.mjs
//
// Opcionales: FAE_API (http://localhost:8000/api/v1) y FAE_ORIGIN (un origen de KONG_CORS_ORIGINS, por defecto
// http://localhost:8090). Abre y cierra sesiones con esa cuenta y espera 31 s para comprobar la caducidad.
// No imprime sesiones, tickets ni contraseñas. Sale con código 1 si algún caso falla.

import http from "node:http";
import { randomBytes } from "node:crypto";

const API = (process.env.FAE_API ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
const ORIGIN = process.env.FAE_ORIGIN ?? "http://localhost:8090";
const EVIL = "https://evil.example";
const USER = process.env.FAE_TEST_USER;
const PASSWORD = process.env.FAE_TEST_PASSWORD;
if (!USER || !PASSWORD) {
    console.error("Define FAE_TEST_USER y FAE_TEST_PASSWORD");
    process.exit(2);
}

let pass = 0;
let fail = 0;
// Lo que llega de la red (cabeceras, cuerpos) se imprime sin saltos de línea ni caracteres de control, para que
// una respuesta con ellos no pueda falsificar líneas del informe (S5145, inyección en registros).
const show = (value) => String(JSON.stringify(value)).replace(/[\r\n]/g, " ").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");
const check = (name, expected, got) => {
    const ok = JSON.stringify(expected) === JSON.stringify(got);
    ok ? (pass += 1) : (fail += 1);
    console.log(`${ok ? "OK   " : "FALLA"} ${name.padEnd(66)} ${ok ? show(got) : `esperado ${show(expected)}, obtenido ${show(got)}`}`);
};

const post = (path, { headers = {}, body } = {}) =>
    fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });

async function login() {
    const res = await post("/auth/login", { body: { identifier: USER, password: PASSWORD } });
    return (await res.json()).sessionId;
}

const logout = (sid) => post("/auth/logout", { headers: { Authorization: `Bearer ${sid}` } });

/** Handshake de WebSocket sin librerías: { status, protocol } (101 si se aceptó). */
function handshake(protocols, origin = ORIGIN) {
    return new Promise((resolve) => {
        const url = new URL(`${API}/biometric/ws`);
        const request = http.request({
            host: url.hostname, port: url.port, path: url.pathname, method: "GET", timeout: 8000,
            headers: {
                Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13",
                "Sec-WebSocket-Key": randomBytes(16).toString("base64"), "Sec-WebSocket-Protocol": protocols,
                ...(origin ? { Origin: origin } : {}),
            },
        });
        request.on("upgrade", (response, socket) => {
            resolve({ status: response.statusCode, protocol: response.headers["sec-websocket-protocol"] });
            socket.destroy();
        });
        request.on("response", (response) => {
            resolve({ status: response.statusCode, protocol: response.headers["sec-websocket-protocol"] });
            response.resume();
        });
        request.on("timeout", () => { resolve({ status: 0 }); request.destroy(); });
        request.on("error", () => resolve({ status: 0 }));
        request.end();
    });
}

const issue = async (sid, extra = {}) => {
    const res = await post("/auth/ws-ticket", { headers: { Authorization: `Bearer ${sid}`, ...extra } });
    return { status: res.status, cache: res.headers.get("cache-control"), body: res.status === 200 ? await res.json() : null };
};

const sid = await login();
check("login de prueba", true, /^[0-9a-f-]{36}$/.test(sid ?? ""));

// ── emitir ──
const noAuth = await post("/auth/ws-ticket");
check("sin sesión no se emite ticket: 401", 401, noAuth.status);
const first = await issue(sid);
check("con sesión: 200", 200, first.status);
check("…el ticket son 32 caracteres hexadecimales", true, /^[0-9a-f]{32}$/.test(first.body?.ticket ?? ""));
check("…caduca en 30 s", 30, first.body?.expiresIn);
check("…no se guarda en caché", "no-store", first.cache);

// ── canjear ──
const used = await handshake(`faceattend.ticket, ${first.body.ticket}`);
check("handshake con el ticket: 101", 101, used.status);
check("…el servidor contesta el subprotocolo que ofreció el navegador", "faceattend.ticket", used.protocol);
const again = await handshake(`faceattend.ticket, ${first.body.ticket}`);
check("el mismo ticket por segunda vez: 401 (un solo uso)", 401, again.status);

// ── rechazos ──
check("ticket inventado: 401", 401, (await handshake(`faceattend.ticket, ${randomBytes(16).toString("hex")}`)).status);
check("ticket con formato inválido: 401", 401, (await handshake("faceattend.ticket, zzzz")).status);
const t2 = await issue(sid);
check("ticket con un Origin ajeno: 401", 401, (await handshake(`faceattend.ticket, ${t2.body.ticket}`, EVIL)).status);
check("ticket sin Origin: 401", 401, (await handshake(`faceattend.ticket, ${t2.body.ticket}`, null)).status);
check("…y un Origin ajeno no lo gasta: con el permitido entra, 101", 101, (await handshake(`faceattend.ticket, ${t2.body.ticket}`)).status);

// ── lo anterior sigue funcionando ──
const legacy = await handshake(`faceattend.bearer, ${sid}`);
check("subprotocolo con el token (camino de siempre): 101", 101, legacy.status);
check("…y contesta faceattend.bearer, sin reescribir", "faceattend.bearer", legacy.protocol);
check("sin ticket ni token: 401", 401, (await handshake("faceattend.bearer, hola")).status);

// ── cookie: la emisión pasa por la defensa CSRF ──
const web = { "X-Session-Mode": "cookie", "X-Requested-With": "FaceAttend", Origin: ORIGIN };
const cookieLogin = await post("/auth/login", { headers: web, body: { identifier: USER, password: PASSWORD } });
const cookieSid = (cookieLogin.headers.get("set-cookie") ?? "").match(/fae_session=([^;]+)/)?.[1];
const viaCookie = await post("/auth/ws-ticket", { headers: { ...web, Cookie: `fae_session=${cookieSid}` } });
check("ticket pedido con la cookie y las cabeceras web: 200", 200, viaCookie.status);
const noHeader = await post("/auth/ws-ticket", { headers: { Origin: ORIGIN, Cookie: `fae_session=${cookieSid}` } });
check("…sin X-Requested-With: 403", 403, noHeader.status);
const foreign = await post("/auth/ws-ticket", { headers: { ...web, Origin: EVIL, Cookie: `fae_session=${cookieSid}` } });
check("…desde un Origin ajeno: 403", 403, foreign.status);
const cookieTicket = (await viaCookie.json()).ticket;
check("el ticket pedido por cookie abre el canal: 101", 101, (await handshake(`faceattend.ticket, ${cookieTicket}`)).status);
await post("/auth/logout", { headers: { ...web, Cookie: `fae_session=${cookieSid}` } });

// ── la sesión cerrada no sirve ──
const sid2 = await login();
const t3 = await issue(sid2);
await logout(sid2);
// La sesión cerrada sigue valiendo hasta 10 s en la caché de Kong y del servicio biométrico (también con el token
// de siempre); pasada esa ventana el ticket ya no sirve.
await new Promise((resolve) => setTimeout(resolve, 11000));
check("ticket de una sesión cerrada, pasada la ventana de 10 s: 401", 401, (await handshake(`faceattend.ticket, ${t3.body.ticket}`)).status);

// ── límite por sesión ──
const sid3 = await login();
let last = 0;
for (let i = 0; i < 21; i += 1) last = (await issue(sid3)).status;
check("el ticket 21 del mismo minuto y sesión: 429", 429, last);
await logout(sid3);

// ── caducidad ──
const t4 = await issue(sid);
await new Promise((resolve) => setTimeout(resolve, 31000));
check("un ticket de más de 30 s: 401", 401, (await handshake(`faceattend.ticket, ${t4.body.ticket}`)).status);

await logout(sid);
console.log(`\nResultado: ${pass} bien, ${fail} con falla`);
process.exit(fail ? 1 : 0);
