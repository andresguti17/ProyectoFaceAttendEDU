// ============================================================
//  FaceAttend EDU — QA · comando único
//
//    npm run qa                 → L1 (API) + L2 (UI) y resumen
//    npm run qa:rebuild         → antes reconstruye el front en Docker
//    npm run qa -- --only=api   → solo L1   (--only=ui → solo L2)
//    npm run qa -- --roles=SUP,ADM --mobile --skip-slow
//
//  Deja los resultados en docs/revision/resultados/ (L1-api, L2-ui, RESUMEN).
//  Código de salida: 0 si no hay FAIL, 1 si los hay, 2 si falló el preflight.
// ============================================================

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { API, RESULTS_DIR, ROLE_USERS, ROOT, WEB, api, loadAccounts, login } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => (args.find((a) => a.startsWith(`--${name}=`)) ?? "").split("=")[1];
const only = value("only");
const REPO_ROOT = path.resolve(ROOT, "..", "..");

const REQUIRED = [
    "faceattend-postgres", "faceattend-kong", "faceattend-ms-identity", "faceattend-ms-authorization",
    "faceattend-ms-academic", "faceattend-ms-scheduling", "faceattend-ms-attendance",
    "faceattend-ms-notification", "faceattend-ms-configuration", "faceattend-ms-biometric", "faceattend-frontend-web",
];

const say = (text) => console.log(text);
const fail = (text) => {
    console.error(`\n✘ ${text}`);
    process.exit(2);
};

// ── 1. Preflight ─────────────────────────────────────────────

say("▶ Preflight");
let running = "";
try {
    running = execFileSync("docker", ["ps", "--format", "{{.Names}} {{.Status}}"], { encoding: "utf8" });
} catch {
    fail("No se pudo ejecutar `docker ps`. ¿Docker está encendido?");
}
const states = Object.fromEntries(running.split(/\r?\n/).filter(Boolean).map((line) => [line.split(" ")[0], line]));
const missing = REQUIRED.filter((name) => !states[name]);
const unhealthy = REQUIRED.filter((name) => states[name] && /unhealthy|starting/i.test(states[name]));
if (missing.length) fail(`Faltan contenedores: ${missing.join(", ")}`);
if (unhealthy.length) fail(`Contenedores no sanos: ${unhealthy.join(", ")}`);
say(`  ✔ ${REQUIRED.length} contenedores arriba`);

// ── 2. Reconstrucción opcional del front ─────────────────────

// Todos los servicios de aplicación: una imagen vieja (p. ej. notification antes
// de la reescritura en TypeScript) da 500 contra el esquema actual.
const APP_SERVICES = ["ms-identity", "ms-authorization", "ms-academic", "ms-scheduling", "ms-attendance", "ms-biometric", "ms-configuration", "ms-quality", "ms-notification", "frontend-web"];

if (flag("rebuild")) {
    say(`▶ Reconstruyendo ${APP_SERVICES.length} servicios de aplicación y el front`);
    const secret = execFileSync("docker", ["exec", "faceattend-ms-biometric", "printenv", "BIOMETRIC_LIVENESS_CHALLENGE_SECRET"], { encoding: "utf8" }).trim();
    const env = { ...process.env, BIOMETRIC_LIVENESS_CHALLENGE_SECRET: secret };
    for (const cmd of [["compose", "build", ...APP_SERVICES], ["compose", "up", "-d", "--no-deps", ...APP_SERVICES], ["restart", "faceattend-kong"]]) {
        const result = spawnSync("docker", cmd, { cwd: REPO_ROOT, env, stdio: "inherit" });
        if (result.status !== 0) fail(`docker ${cmd.join(" ")} falló`);
    }
    // Kong cachea las IPs de los upstreams: tras recrear contenedores devuelve 503 hasta reiniciarse.
    await new Promise((resolve) => setTimeout(resolve, 15000));
}

// ── 3. Alcanzabilidad y cuentas ──────────────────────────────

try {
    const response = await fetch(WEB, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) fail(`La web ${WEB} respondió ${response.status}`);
    say(`  ✔ web ${WEB} responde`);
} catch (error) {
    fail(`La web ${WEB} no responde (${error.message}). Defina QA_WEB_URL o levante el front.`);
}

const accounts = loadAccounts();
const noPassword = Object.values(ROLE_USERS).filter((user) => !accounts[user]);
if (noPassword.length) say(`  ⚠ sin contraseña en docs/revision/.cuentas.local: ${noPassword.join(", ")} (esos roles quedarán BLOQUEADO)`);
const probe = accounts[ROLE_USERS.SUP] ? await login(ROLE_USERS.SUP, accounts[ROLE_USERS.SUP]) : null;
if (!probe) fail(`No se pudo iniciar sesión como ${ROLE_USERS.SUP}. Revise docs/revision/.cuentas.local y la API ${API}.`);
say(`  ✔ gateway ${API} y login funcionan`);

// ── 4. Ejecución ─────────────────────────────────────────────

const pass = (names) => args.filter((a) => names.some((n) => a.startsWith(`--${n}`)));
const steps = [];
if (only !== "ui") steps.push({ name: "L1 · API", script: "api-matrix.mjs", args: pass(["skip-slow", "only=NEG"]) });
if (only !== "api") steps.push({ name: "L2 · UI", script: "ui-smoke.mjs", args: pass(["roles", "mobile", "headed"]) });

let anyFail = false;
for (const step of steps) {
    say(`\n▶ ${step.name}`);
    const result = spawnSync(process.execPath, [path.join(ROOT, "tools", "qa", step.script), ...step.args], { stdio: "inherit", cwd: ROOT });
    if (result.status !== 0) anyFail = true;
}

// ── 5. Resumen ───────────────────────────────────────────────

const SEVERITY_RANK = { Bloqueante: 0, Alta: 1, Media: 2, Baja: 3, "": 4 };
const sections = [];
let grand = { PASS: 0, FAIL: 0, DUDA: 0, BLOQUEADO: 0 };
for (const [file, title] of [["L1-api.json", "L1 · API"], ["L2-ui.json", "L2 · UI"]]) {
    const full = path.join(RESULTS_DIR, file);
    if (!existsSync(full)) continue;
    const data = JSON.parse(readFileSync(full, "utf8"));
    for (const key of Object.keys(grand)) grand[key] += data.totals[key] ?? 0;
    const fails = data.rows.filter((r) => r.verdict === "FAIL").sort((a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4));
    const doubts = data.rows.filter((r) => r.verdict === "DUDA");
    sections.push(
        `## ${title}`,
        `${data.totals.PASS} PASS · ${data.totals.FAIL} FAIL · ${data.totals.DUDA} DUDA · ${data.totals.BLOQUEADO} BLOQUEADO`,
        "",
        fails.length ? "### FAIL" : "### FAIL\nNinguno.",
        ...fails.map((r) => `- **${r.id}** [${r.severity || "—"}] ${r.who ?? ""} — ${r.request ?? ""} ${r.note ? `· ${r.note}` : ""}`),
        "",
        doubts.length ? "### DUDA (revisa el supervisor)" : "### DUDA\nNinguna.",
        ...doubts.map((r) => `- **${r.id}** ${r.who ?? ""} — ${r.request ?? ""} ${r.note ? `· ${r.note}` : ""}`),
        ""
    );
}
const summary = [
    "# Resumen de la revisión automatizada",
    "",
    `- Fecha: ${new Date().toISOString()}`,
    `- Web: ${WEB} · API: ${API}`,
    `- Total: ${grand.PASS} PASS · ${grand.FAIL} FAIL · ${grand.DUDA} DUDA · ${grand.BLOQUEADO} BLOQUEADO`,
    "",
    ...sections,
    "Detalle completo: `L1-api.md`, `L2-ui.md`. Capturas de rutas no PASS: `ui/`.",
    "",
].join("\n");
writeFileSync(path.join(RESULTS_DIR, "RESUMEN.md"), summary, "utf8");
say(`\n■ Resumen: ${grand.PASS} PASS · ${grand.FAIL} FAIL · ${grand.DUDA} DUDA · ${grand.BLOQUEADO} BLOQUEADO`);
say(`  docs/revision/resultados/RESUMEN.md`);
process.exit(anyFail || grand.FAIL > 0 ? 1 : 0);
