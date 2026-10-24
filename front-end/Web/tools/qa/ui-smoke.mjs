// ============================================================
//  FaceAttend EDU — QA · L2 humo de interfaz
//
//  Por cada rol (Super Admin → Admin → Docente → Estudiante) inicia
//  sesión por el formulario real y abre cada ruta del menú y las que
//  no le corresponden. Falla ante:
//    · pantalla en blanco o error no capturado en consola
//    · "undefined", "NaN" o "[object Object]" visibles
//    · respuestas 5xx (y lista las 4xx)
//    · una ruta prohibida que muestra contenido de gestión
//
//  Navega dentro de la app (sin recargar) para no repetir la carga inicial,
//  que dispara cientos o miles de peticiones y choca con el límite de Kong.
//  Con --deep recarga la página completa en cada ruta (enlace directo real).
//
//  Uso: node tools/qa/ui-smoke.mjs [--roles=SUP,ADM] [--mobile] [--deep] [--headed]
//  Requiere Chrome o Edge instalado (playwright-core no descarga navegadores).
// ============================================================

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { RESULTS_DIR, ROLE_USERS, VERDICT, WEB, excerpt, loadAccounts, sqlOne, writeReport } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const rolesArg = (args.find((a) => a.startsWith("--roles=")) ?? "").replace("--roles=", "").split(",").filter(Boolean);

// ── Rutas por rol (docs/revision/01..04) ─────────────────────
// ok = debe cargar · denied = debe dar "Acceso denegado" o redirigir · record = solo registrar

const ok = (p) => ({ path: p, expect: "ok" });
const denied = (p) => ({ path: p, expect: "denied" });
const record = (p) => ({ path: p, expect: "record" });

const ROUTES = {
    SUP: [
        ok("/app"), ok("/app/schools"), ok("/app/users"), ok("/app/users/students"), ok("/app/users/teachers"),
        ok("/app/users/admins"), ok("/app/roles"), ok("/app/reports"), ok("/app/history"), ok("/app/alerts"),
        ok("/app/settings"),
        record("/app/courses"), record("/app/environments"), record("/app/academic"), record("/app/justifications"),
        record("/app/kiosk"), record("/app/biometrics"), record("/app/contacts"), record("/app/school-info"),
        record("/app/ruta-que-no-existe"),
    ],
    ADM: [
        ok("/app"), ok("/app/users"), ok("/app/users/students"), ok("/app/users/teachers"), ok("/app/users/admins"),
        ok("/app/courses"), ok("/app/environments"), ok("/app/academic"), ok("/app/history"), ok("/app/justifications"),
        ok("/app/alerts"), ok("/app/reports"), ok("/app/settings"), ok("/app/kiosk"),
        denied("/app/schools"), denied("/app/roles"),
        record("/app/biometrics"), record("/app/contacts"), record("/app/school-info"),
    ],
    DOC: [
        ok("/app"), ok("/app/users"), ok("/app/courses"), ok("/app/environments"), ok("/app/history"),
        ok("/app/justifications"), ok("/app/alerts"), ok("/app/reports"), ok("/app/settings"), ok("/app/kiosk"),
        denied("/app/schools"), denied("/app/roles"),
        record("/app/academic"), record("/app/users/teachers"), record("/app/users/admins"),
        record("/app/biometrics"), record("/app/contacts"), record("/app/school-info"),
    ],
    EST: [
        ok("/app"), ok("/app/history"), ok("/app/justifications"), ok("/app/courses"), ok("/app/academic"),
        ok("/app/alerts"), ok("/app/settings"),
        denied("/app/users"), denied("/app/users/students"), denied("/app/environments"), denied("/app/reports"),
        denied("/app/kiosk"), denied("/app/schools"), denied("/app/roles"),
        record("/app/settings/general"), record("/app/biometrics"), record("/app/contacts"), record("/app/school-info"),
    ],
};

const ORDER = ["SUP", "ADM", "DOC", "EST"];
const NAMES = { SUP: "Super Admin", ADM: "Admin", DOC: "Docente", EST: "Estudiante" };
const BAD_TEXT = /\bundefined\b|\bNaN\b|\[object Object\]/;
const DENIED_TEXT = /acceso denegado/i;
const FATAL_CONSOLE = /Uncaught|TypeError|ReferenceError|is not a function|is not defined|Cannot read propert/;

const accounts = loadAccounts();
const rows = [];
const screenshotsDir = path.join(RESULTS_DIR, "ui");
mkdirSync(screenshotsDir, { recursive: true });

const slug = (value) => value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";

// ── Navegador ────────────────────────────────────────────────

async function launch() {
    const options = { headless: !flag("headed") };
    for (const attempt of [{ channel: "chrome" }, { channel: "msedge" }]) {
        try {
            return await chromium.launch({ ...options, ...attempt });
        } catch {
            /* probar el siguiente */
        }
    }
    const candidates = [
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ].filter(existsSync);
    if (candidates.length) return chromium.launch({ ...options, executablePath: candidates[0] });
    throw new Error("No se encontró Chrome ni Edge. Instálalo o define el ejecutable en lib/ui-smoke.");
}

/** Espera a que la app deje de pedir cosas (la carga inicial dispara cientos de peticiones). */
async function settle(page, tracker, maxMs = 45000) {
    const started = Date.now();
    let quietSince = Date.now();
    while (Date.now() - started < maxMs) {
        if (tracker.inflight > 0) quietSince = Date.now();
        if (Date.now() - quietSince >= 1800) break;
        await page.waitForTimeout(250);
    }
    await page.waitForTimeout(600);
    return Date.now() - started;
}

function track(page) {
    const state = { inflight: 0, errors: [], consoleErrors: [], bad: [], total: 0 };
    page.on("request", () => {
        state.inflight += 1;
        state.total += 1;
    });
    const done = () => (state.inflight = Math.max(0, state.inflight - 1));
    page.on("requestfinished", done);
    page.on("requestfailed", done);
    page.on("response", (response) => {
        const status = response.status();
        if (status >= 400 && !/(?:favicon|hot-update|\.map$)/.test(response.url())) {
            state.bad.push({ status, method: response.request().method(), url: response.url().replace(/^https?:\/\/[^/]+/, "") });
        }
    });
    page.on("pageerror", (error) => state.errors.push(String(error?.message ?? error)));
    page.on("console", (message) => {
        if (message.type() === "error" && FATAL_CONSOLE.test(message.text())) state.consoleErrors.push(message.text().slice(0, 160));
    });
    return state;
}

const reset = (state) => {
    state.total = 0;
    state.errors.length = 0;
    state.consoleErrors.length = 0;
    state.bad.length = 0;
};

// ── Login por el formulario real ─────────────────────────────

async function loginUi(page, tracker, role) {
    const username = ROLE_USERS[role];
    const password = accounts[username];
    if (!password) return { verdict: VERDICT.BLOQUEADO, note: `sin contraseña de ${username} en .cuentas.local` };
    const email = sqlOne(`SELECT p.email FROM identity.person p JOIN identity.app_user u ON u.person_id=p.person_id WHERE u.username='${username.replace(/'/g, "''")}' LIMIT 1`);
    if (!email) return { verdict: VERDICT.BLOQUEADO, note: `no se encontró el correo de ${username}` };

    await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" });
    const emailInput = page.locator('input[type="email"], input[placeholder*="correo"]').first();
    await emailInput.waitFor({ timeout: 30000 });
    await emailInput.fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.keyboard.press("Enter");
    try {
        await page.waitForURL(/\/app(\/|$|\?)/, { timeout: 30000 });
    } catch {
        return { verdict: VERDICT.FAIL, severity: "Bloqueante", note: `no llegó a /app tras iniciar sesión (URL: ${page.url()})` };
    }
    await settle(page, tracker);
    return { verdict: VERDICT.PASS };
}

// ── Revisión de una ruta ─────────────────────────────────────

async function visit(page, tracker, role, route, viewport) {
    const id = `L2-${role}-${route.path}${viewport === "mobile" ? " (375px)" : ""}`;
    const who = `${NAMES[role]} · ${route.path}`;

    const attempt = async () => {
        reset(tracker);
        if (flag("deep")) {
            await page.goto(`${WEB}${route.path}`, { waitUntil: "domcontentloaded" });
        } else {
            // Navegación interna: la app escucha popstate para resolver la ruta.
            await page.evaluate((target) => {
                window.history.pushState({}, "", target);
                window.dispatchEvent(new PopStateEvent("popstate"));
            }, route.path);
        }
        const ms = await settle(page, tracker, flag("deep") ? 45000 : 20000);
        const text = await page.evaluate(() => document.body?.innerText ?? "");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        return { ms, text, overflow, url: page.url() };
    };

    let seen = await attempt();
    const blankNow = (seen.text ?? "").trim().length < 30;
    if (blankNow && tracker.bad.some((b) => b.status === 429)) {
        await page.waitForTimeout(35000); // límite de ritmo de Kong: esperar y reintentar una vez
        seen = await attempt();
    }
    const { text, ms, overflow, url } = seen;
    const denied = DENIED_TEXT.test(text);
    const redirected = !url.startsWith(`${WEB}${route.path}`) && !/ruta-que-no-existe/.test(route.path);
    const blank = text.trim().length < 30;
    const fatal = [...tracker.errors, ...tracker.consoleErrors];
    const serverErrors = tracker.bad.filter((b) => b.status >= 500);
    const clientErrors = tracker.bad.filter((b) => b.status >= 400 && b.status < 500 && b.status !== 429);
    const badText = text.match(BAD_TEXT)?.[0];
    const request = `${tracker.total} peticiones · ${ms} ms${tracker.bad.length ? ` · ${tracker.bad.length} con error` : ""}`;

    let verdict = VERDICT.PASS;
    let severity = "";
    const notes = [];

    if (fatal.length) {
        verdict = VERDICT.FAIL; severity = "Bloqueante"; notes.push(`error no capturado: ${fatal[0]}`);
    } else if (blank) {
        verdict = VERDICT.FAIL; severity = "Bloqueante"; notes.push("pantalla en blanco");
    }

    if (verdict !== VERDICT.FAIL) {
        if (route.expect === "ok") {
            if (denied) { verdict = VERDICT.FAIL; severity = "Alta"; notes.push("muestra 'Acceso denegado' en una ruta permitida"); }
            else if (badText) { verdict = VERDICT.FAIL; severity = "Media"; notes.push(`texto inválido en pantalla: ${badText}`); }
        } else if (route.expect === "denied") {
            if (!denied && !redirected) { verdict = VERDICT.FAIL; severity = "Alta"; notes.push("la ruta prohibida muestra contenido"); }
        } else if (route.expect === "record") {
            if (!denied && !redirected) { verdict = VERDICT.DUDA; notes.push("carga con contenido (sin expectativa definida)"); }
        }
    }
    if (verdict !== VERDICT.FAIL && serverErrors.length) {
        verdict = VERDICT.FAIL; severity = "Alta"; notes.push(`5xx: ${serverErrors.slice(0, 2).map((b) => `${b.method} ${b.url} → ${b.status}`).join("; ")}`);
    }
    if (verdict === VERDICT.PASS && clientErrors.length) {
        const expectedDenied = route.expect === "denied" || route.expect === "record";
        if (!expectedDenied) {
            verdict = VERDICT.DUDA;
            notes.push(`4xx: ${clientErrors.slice(0, 3).map((b) => `${b.method} ${b.url} → ${b.status}`).join("; ")}`);
        }
    }
    if (viewport === "mobile" && overflow > 4 && verdict === VERDICT.PASS) {
        verdict = VERDICT.DUDA; notes.push(`scroll horizontal de ${overflow}px`);
    }
    notes.unshift(denied ? "Acceso denegado" : redirected ? `redirige a ${url.replace(WEB, "")}` : blank ? "en blanco" : "con contenido");

    if (verdict !== VERDICT.PASS) {
        await page.screenshot({ path: path.join(screenshotsDir, `${role}-${slug(route.path)}${viewport === "mobile" ? "-m" : ""}.png`) }).catch(() => {});
    }
    rows.push({ id, verdict, severity, who, request, evidence: excerpt(text, 100), note: notes.join(" · ") });
}

// ── Principal ────────────────────────────────────────────────

(async () => {
    const started = Date.now();
    let browser;
    try {
        browser = await launch();
    } catch (error) {
        console.error(`L2 UI: ${error.message}`);
        rows.push({ id: "L2-NAVEGADOR", verdict: VERDICT.BLOQUEADO, who: "script", note: error.message });
    }

    if (browser) {
        for (const role of ORDER) {
            if (rolesArg.length && !rolesArg.includes(role)) continue;
            const viewports = flag("mobile") ? [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 812 }]] : [["desktop", { width: 1280, height: 800 }]];
            for (const [viewportName, size] of viewports) {
                const context = await browser.newContext({ viewport: size });
                const page = await context.newPage();
                const tracker = track(page);
                const logged = await loginUi(page, tracker, role);
                rows.push({ id: `L2-${role}-login${viewportName === "mobile" ? " (375px)" : ""}`, verdict: logged.verdict, severity: logged.severity ?? "", who: NAMES[role], request: `${tracker.total} peticiones`, evidence: "", note: logged.note ?? "" });
                if (logged.verdict === VERDICT.PASS) {
                    const list = viewportName === "mobile" ? ROUTES[role].filter((r) => r.expect === "ok") : ROUTES[role];
                    for (const route of list) {
                        try {
                            await visit(page, tracker, role, route, viewportName);
                        } catch (error) {
                            rows.push({ id: `L2-${role}-${route.path}`, verdict: VERDICT.FAIL, severity: "Alta", who: `${NAMES[role]} · ${route.path}`, note: `el script falló: ${String(error.message).slice(0, 120)}` });
                        }
                        process.stdout.write(`  ${NAMES[role]} ${route.path} → ${rows.at(-1).verdict}\n`);
                        await page.waitForTimeout(1500);
                    }
                }
                await context.close();
            }
        }
        await browser.close();
    }

    const totals = writeReport("L2-ui", "L2 · Humo de interfaz por rol", rows, { Duración: `${Math.round((Date.now() - started) / 1000)} s`, Capturas: "resultados/ui/ (solo rutas no PASS)", Modo: flag("deep") ? "recarga completa por ruta" : "navegación interna" });
    console.log(`L2 UI: ${totals.PASS} PASS · ${totals.FAIL} FAIL · ${totals.DUDA} DUDA · ${totals.BLOQUEADO} BLOQUEADO`);
    for (const r of rows.filter((x) => x.verdict === VERDICT.FAIL)) console.log(`  FAIL ${r.id} [${r.severity || "-"}] ${r.note}`);
    process.exit(totals.FAIL > 0 ? 1 : 0);
})();
