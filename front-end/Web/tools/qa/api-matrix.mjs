// ============================================================
//  FaceAttend EDU — QA · L1 matriz de API (docs/revision/05-negativos.md §A)
//
//  Ejecuta los casos negativos contra el gateway con la sesión de cada
//  rol y juzga cada respuesta con las reglas del archivo 05:
//    · acción prohibida con 2xx        → FAIL Bloqueante (y se revierte)
//    · 5xx / stack trace               → FAIL Alta
//    · 4xx dentro de lo esperado       → PASS
//    · 4xx fuera de lo esperado        → DUDA (anota el código real)
//  Datos de prueba `QA-…`: se crean por API y se desactivan al final.
//  La base solo se consulta con SELECT.
//
//  Uso: node tools/qa/api-matrix.mjs [--only=NEG-B,NEG-C] [--skip-slow]
// ============================================================

import { readFileSync } from "node:fs";
import path from "node:path";
import {
    API, REVISION_DIR, ROLE_USERS, VERDICT, api, excerpt, fetchAll, loadAccounts, login, randomId, sql, sqlOne,
    summarize, wsHandshake, writeReport,
} from "./lib.mjs";

const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith("--only=")) ?? "").replace("--only=", "").split(",").filter(Boolean);
const skipSlow = args.includes("--skip-slow");

const accounts = loadAccounts();
const results = [];
const covered = new Set();
const sessions = {};
const cleanups = [];
const rid = randomId();

// ── Registro de resultados ───────────────────────────────────

function push(id, verdict, { who = "", request = "", evidence = "", severity = "", note = "" } = {}) {
    covered.add(id.replace(/^(NEG-C17)-.*/, "$1"));
    results.push({ id, verdict, who, request, evidence, severity, note });
}

const selected = (id) => !only.length || only.some((prefix) => id.startsWith(prefix));

// ── Juicio de una respuesta ──────────────────────────────────

function judge(kind, res, expect = [], accept = []) {
    const s = res.status;
    if (s === 0) return { verdict: VERDICT.DUDA, note: `sin respuesta (${res.error ?? "?"})` };
    if (s >= 500) return { verdict: VERDICT.FAIL, severity: "Alta", note: "error 5xx" };
    const success = s >= 200 && s < 300;
    if (/stack|Exception|at com\.|SQLSTATE|org\.postgres/i.test(res.text)) {
        return { verdict: VERDICT.FAIL, severity: "Alta", note: "la respuesta expone detalles internos" };
    }
    if (kind === "forbidden" && success) {
        return { verdict: VERDICT.FAIL, severity: "Bloqueante", note: "acción prohibida ejecutada" };
    }
    if (kind === "invalid" && success && !expect.some((c) => c >= 200 && c < 300)) {
        return { verdict: VERDICT.FAIL, severity: "Alta", note: "entrada inválida aceptada" };
    }
    if (kind === "allowed" && (s === 401 || s === 403)) {
        return { verdict: VERDICT.FAIL, severity: "Alta", note: "debería poder y recibió " + s };
    }
    if (expect.includes(s)) return { verdict: VERDICT.PASS };
    if (accept.includes(s)) return { verdict: VERDICT.PASS, note: `aceptable ${s}` };
    return { verdict: VERDICT.DUDA, note: `status real ${s}; esperado ${expect.join("/")}` };
}

// ── Ejecución de un caso ─────────────────────────────────────

async function run(spec) {
    const { id, role, method = "GET", kind = "forbidden", expect = [], accept = [], note = "" } = spec;
    if (!selected(id)) return;
    const who = role;
    if (spec.skip) return push(id, VERDICT.BLOQUEADO, { who, note: spec.skip });

    const session = role === "ANON" ? null : sessions[role];
    if (role !== "ANON" && !session) {
        return push(id, VERDICT.BLOQUEADO, { who, note: `sin sesión para ${role} (revisar .cuentas.local)` });
    }
    const route = typeof spec.path === "function" ? spec.path() : spec.path;
    if (!route || route.includes("undefined") || route.includes("null")) {
        return push(id, VERDICT.BLOQUEADO, { who, note: "falta un dato de prueba para este caso" });
    }
    const body = typeof spec.body === "function" ? spec.body() : spec.body;
    const token = spec.token !== undefined ? spec.token : session?.token;
    const res = await api(method, route, { token, body, headers: spec.headers, rawBody: spec.rawBody });

    const outcome = spec.check ? await spec.check(res) : judge(kind, res, expect, accept);
    push(id, outcome.verdict, {
        who,
        request: `${method} ${route.split("?")[0]} → ${res.status}`,
        evidence: excerpt(res.text),
        severity: outcome.severity ?? "",
        note: [outcome.note, note].filter(Boolean).join(" · "),
    });

    // Si lo prohibido llegó a ejecutarse (o se creó algo), se deshace.
    if (res.status >= 200 && res.status < 300 && spec.revert) {
        try {
            await spec.revert(res);
        } catch (error) {
            results.at(-1).note += ` · REVERSIÓN FALLÓ: ${error.message}`;
        }
    }
}

// ── Utilidades de datos ──────────────────────────────────────

const q = (value) => String(value).replace(/'/g, "''");
const uuidList = (ids) => ids.map((id) => `'${q(id)}'`).join(",");

function schoolOf(username) {
    return sqlOne(
        `SELECT a.school_id FROM identity.app_user u JOIN academic.academic_actor a ON a.person_id=u.person_id AND a.deleted_at IS NULL WHERE u.username='${q(username)}' ORDER BY a.academic_actor_id LIMIT 1`
    );
}

/** Datos de contraste que pertenecen a una sede (o null si no hay). */
function targetsOf(schoolId) {
    if (!schoolId) return {};
    const first = (query) => sql(query)[0] ?? [];
    const [userId, personId, actorId] = first(
        `SELECT u.user_id, p.person_id, a.academic_actor_id FROM academic.academic_actor a JOIN academic.academic_actor_type t ON t.actor_type_id=a.actor_type_id AND t.code='STUDENT' JOIN identity.person p ON p.person_id=a.person_id AND p.deleted_at IS NULL JOIN identity.app_user u ON u.person_id=p.person_id AND u.deleted_at IS NULL WHERE a.school_id=${schoolId} AND a.deleted_at IS NULL AND a.status=true ORDER BY a.academic_actor_id LIMIT 1`
    );
    const [programId] = first(`SELECT program_id FROM academic.program WHERE school_id=${schoolId} AND deleted_at IS NULL ORDER BY 1 LIMIT 1`);
    const [courseId] = first(
        `SELECT c.course_id FROM academic.course c JOIN academic.program p ON p.program_id=c.program_id WHERE p.school_id=${schoolId} AND c.deleted_at IS NULL ORDER BY 1 LIMIT 1`
    );
    const [cohortId] = first(
        `SELECT c.cohort_id FROM academic.cohort c JOIN academic.program p ON p.program_id=c.program_id WHERE p.school_id=${schoolId} AND c.deleted_at IS NULL ORDER BY 1 LIMIT 1`
    );
    const [environmentId] = first(`SELECT environment_id FROM scheduling.environment WHERE school_id=${schoolId} AND deleted_at IS NULL ORDER BY 1 LIMIT 1`);
    const [sessionId] = first(
        `SELECT cs.class_session_id FROM scheduling.class_session cs JOIN scheduling.schedule_block b ON b.schedule_block_id=cs.schedule_block_id JOIN academic.cohort co ON co.cohort_id=b.cohort_id JOIN academic.program p ON p.program_id=co.program_id WHERE p.school_id=${schoolId} AND cs.deleted_at IS NULL ORDER BY 1 LIMIT 1`
    );
    const [blockId, bCohort, bCourse, bEnv, bInstr, bDay, bStart, bEnd] = first(
        `SELECT b.schedule_block_id, b.cohort_id, b.course_id, b.environment_id, b.instructor_actor_id, b.day_of_week, b.starts_at, b.ends_at FROM scheduling.schedule_block b JOIN academic.cohort co ON co.cohort_id=b.cohort_id JOIN academic.program p ON p.program_id=co.program_id WHERE p.school_id=${schoolId} AND b.deleted_at IS NULL ORDER BY 1 LIMIT 1`
    );
    return {
        schoolId, userId, personId, actorId, programId, courseId, cohortId, environmentId, sessionId,
        block: blockId ? { blockId, cohortId: bCohort, courseId: bCourse, environmentId: bEnv, instructorActorId: bInstr, dayOfWeek: bDay, startsAt: bStart, endsAt: bEnd } : null,
    };
}

const roleId = (name) => sqlOne(`SELECT role_id FROM "authorization".role WHERE role_name='${q(name)}' AND deleted_at IS NULL LIMIT 1`);

// ── Datos QA creados por API ─────────────────────────────────

const qa = {};

async function createQaPerson(token, suffix = "") {
    const tag = `${rid}${suffix}`;
    const res = await api("POST", "/persons", {
        token,
        body: {
            documentNumber: `QA${tag}${Date.now() % 100000}`.slice(0, 20),
            name: "QA", lastName: "Matriz", email: `qa-${tag}@example.test`, status: true, documentType: "CC",
        },
    });
    return res.status === 201 || res.status === 200 ? res.json : null;
}

async function setup() {
    for (const [role, username] of Object.entries(ROLE_USERS)) {
        const password = accounts[username];
        sessions[role] = password ? await login(username, password) : null;
    }
    const sup = sessions.SUP?.token;
    if (!sup) return;

    // La crea el Administrador de sede: una persona sin sede solo la gestiona quien la creó.
    const person = await createQaPerson(sessions.ADM?.token ?? sup, "p");
    qa.personId = person?.personId ?? person?.person_id ?? null;
    qa.person = person;
    if (qa.personId) {
        const user = await api("POST", "/users", {
            token: sup,
            body: { personId: qa.personId, username: `qa.${rid}`, password: "Qa12345678!x", authenticationType: "Local" },
        });
        qa.userId = user.json?.userId ?? user.json?.user_id ?? null;
        cleanups.push(async () => {
            if (qa.userId) await api("PATCH", `/users/${qa.userId}/status?status=false`, { token: sup });
            await api("PATCH", `/persons/${qa.personId}/status?status=false`, { token: sup });
        });
    }
}

async function runCleanups() {
    for (const fn of cleanups.reverse()) {
        try {
            await fn();
        } catch {
            /* limpieza best-effort */
        }
    }
    // Red de seguridad: desactiva cualquier persona/usuario QA que siga activo (incluidos los de ejecuciones anteriores).
    const sup = sessions.SUP?.token;
    if (!sup) return;
    for (const [userId] of sql("SELECT user_id FROM identity.app_user WHERE username LIKE 'qa.%' AND status=true AND deleted_at IS NULL")) {
        await api("PATCH", `/users/${userId}/status?status=false`, { token: sup });
    }
    for (const [personId] of sql("SELECT person_id FROM identity.person WHERE email LIKE 'qa-%@example.test' AND status=true AND deleted_at IS NULL")) {
        await api("PATCH", `/persons/${personId}/status?status=false`, { token: sup });
    }
}

// ═════════════════════════════════════════════════════════════
//  Definición de la matriz
// ═════════════════════════════════════════════════════════════

async function main() {
    const sup = sessions.SUP?.token;
    const sena = schoolOf(ROLE_USERS.ADM);
    const ict = schoolOf(ROLE_USERS.ADM2);
    const own = sessions.EST
        ? sql(`SELECT u.user_id, p.person_id, a.academic_actor_id FROM identity.app_user u JOIN identity.person p ON p.person_id=u.person_id JOIN academic.academic_actor a ON a.person_id=p.person_id AND a.deleted_at IS NULL WHERE u.username='${ROLE_USERS.EST}' LIMIT 1`)[0] ?? []
        : [];
    const [ownUser, ownPerson, ownActor] = own;
    const compa = ownActor
        ? sql(`SELECT a.academic_actor_id, a.person_id FROM academic.enrollment e JOIN academic.enrollment me ON me.cohort_id=e.cohort_id AND me.academic_actor_id=${ownActor} JOIN academic.academic_actor a ON a.academic_actor_id=e.academic_actor_id WHERE e.academic_actor_id<>${ownActor} AND e.deleted_at IS NULL LIMIT 1`)[0] ?? []
        : [];
    const [compaActor, compaPerson] = compa;
    const T = { sena: targetsOf(sena), ict: targetsOf(ict) };
    const ROL_ADMIN = roleId("Administrador");
    const ROL_SUPER = roleId("Super Administrador");
    const ROL_APRENDIZ = roleId("Aprendiz");
    const other = sqlOne(`SELECT school_id FROM academic.school WHERE deleted_at IS NULL AND school_id NOT IN (${sena ?? 0},${ict ?? 0}) ORDER BY 1 LIMIT 1`);
    const T3 = targetsOf(other);
    const today = new Date().toISOString().slice(0, 10);
    const revertStatus = (userId) => async () => api("PATCH", `/users/${userId}/status?status=true`, { token: sup });
    const revertRole = (userId, rId) => async () => api("DELETE", `/users/${userId}/roles/${rId}`, { token: sup });
    const qaPersonBody = (tag) => ({
        documentNumber: `QA${rid}${tag}${Date.now() % 100000}`.slice(0, 20), name: "QA", lastName: "Neg",
        email: `qa-${rid}-${tag}@example.test`, status: true, documentType: "CC",
    });
    const dropPerson = (res) => async () => {
        const id = res.json?.personId ?? res.json?.person_id;
        if (id) await api("PATCH", `/persons/${id}/status?status=false`, { token: sup });
    };

    // ── A1 · Autenticación ───────────────────────────────────
    for (const [n, route] of [["01", "/persons"], ["02", "/users"], ["03", "/academic-actors"], ["04", "/attendance-records"]]) {
        await run({ id: `NEG-A${n}`, role: "ANON", path: route, expect: [401] });
    }
    await run({
        id: "NEG-A19", role: "ANON", path: `/auth/me?username=${ROLE_USERS.EST}`, expect: [401],
        note: "GET /auth/me es público en Kong y devuelve personId, estado y último acceso de cualquier usuario",
    });
    await run({ id: "NEG-A05", role: "EST", path: "/persons", token: "abc", expect: [401] });
    await run({ id: "NEG-A06", role: "EST", path: "/persons", token: "00000000-0000-0000-0000-000000000000", expect: [401] });
    await run({ id: "NEG-A07", role: "EST", path: "/persons", token: null, headers: { Authorization: "Basic eHh4Onh4eA==" }, expect: [401] });
    await run({ id: "NEG-A08", role: "EST", path: () => `/persons?token=${sessions.EST?.token}`, token: null, expect: [401] });

    if (!selected("NEG-A09") || skipSlow) {
        if (selected("NEG-A09")) push("NEG-A09", VERDICT.BLOQUEADO, { who: "EST", note: "omitido por --skip-slow (espera 11 s)" });
    } else if (accounts[ROLE_USERS.EST]) {
        const fresh = await api("POST", "/auth/login", { body: { email: ROLE_USERS.EST, password: accounts[ROLE_USERS.EST] } });
        const tk = fresh.json?.sessionId;
        await api("POST", `/auth/logout?sessionId=${tk}`, { token: tk });
        await new Promise((resolve) => setTimeout(resolve, 11000));
        const after = await api("GET", "/persons?limit=1", { token: tk });
        push("NEG-A09", after.status === 401 ? VERDICT.PASS : after.status >= 200 && after.status < 300 ? VERDICT.FAIL : VERDICT.DUDA, {
            who: "EST", request: `GET /persons (token cerrado, +11 s) → ${after.status}`, evidence: excerpt(after.text),
            severity: after.status < 300 ? "Bloqueante" : "",
        });
    }

    await run({ id: "NEG-A10", role: "ANON", method: "POST", path: "/auth/login", body: {}, kind: "invalid", expect: [400], accept: [401, 422] });
    await run({ id: "NEG-A11", role: "ANON", method: "POST", path: "/auth/login", body: { email: ROLE_USERS.EST, password: "mala-clave-QA" }, kind: "invalid", expect: [401] });
    const a11 = results.find((r) => r.id === "NEG-A11");
    await run({ id: "NEG-A12", role: "ANON", method: "POST", path: "/auth/login", body: { email: "' OR 1=1 --", password: "x" }, kind: "invalid", expect: [401], accept: [400] });
    await run({
        id: "NEG-A13", role: "ANON", method: "POST", path: "/auth/login", body: { email: `no.existe.${rid}`, password: "x" }, kind: "invalid", expect: [401],
        check: async (res) => {
            const base = judge("invalid", res, [401]);
            const same = a11 && a11.evidence === excerpt(res.text);
            return same || base.verdict !== VERDICT.PASS ? base : { verdict: VERDICT.DUDA, note: "el mensaje difiere del de contraseña errónea (podría revelar que el usuario no existe)" };
        },
    });
    await run({ id: "NEG-A14", role: "ANON", method: "POST", path: "/auth/forgot-password", body: { email: `no.existe.${rid}@example.test` }, kind: "allowed", expect: [202] });
    await run({
        id: "NEG-A15", role: "ANON", method: "POST", path: "/auth/reset-password", kind: "forbidden", expect: [400, 401, 403], accept: [422],
        body: () => ({ email: qa.person?.email ?? `qa-${rid}-p@example.test`, password: "Otra12345!x" }),
        skip: qa.personId ? undefined : "no se pudo crear la persona QA",
    });
    if (selected("NEG-A16")) {
        const t = sessions.EST?.token;
        const r = t ? await wsHandshake("/biometric/ws", { token: t }) : null;
        push("NEG-A16", !t ? VERDICT.BLOQUEADO : r.status === 101 ? VERDICT.PASS : VERDICT.FAIL, { who: "EST", request: `WS /biometric/ws?token → ${r?.status}`, severity: r?.status === 101 ? "" : "Alta", note: t ? "" : "sin sesión EST" });
        const noTok = await wsHandshake("/biometric/ws");
        push("NEG-A17", noTok.status === 401 ? VERDICT.PASS : noTok.status === 101 ? VERDICT.FAIL : VERDICT.DUDA, { who: "ANON", request: `WS /biometric/ws → ${noTok.status}`, severity: noTok.status === 101 ? "Bloqueante" : "" });
        const bad = await wsHandshake("/biometric/ws", { token: "00000000-0000-0000-0000-000000000000" });
        push("NEG-A18", bad.status === 401 ? VERDICT.PASS : bad.status === 101 ? VERDICT.FAIL : VERDICT.DUDA, { who: "ANON", request: `WS token inexistente → ${bad.status}`, severity: bad.status === 101 ? "Bloqueante" : "" });
    }

    // ── A2 · Permisos por rol ────────────────────────────────
    const foreignUserBody = () => ({ personId: "00000000-0000-4000-8000-000000000001", username: `qa.b.${rid}`, password: "Qa12345678!x", authenticationType: "Local" });
    await run({ id: "NEG-B01", role: "EST", path: "/users", expect: [403] });
    await run({ id: "NEG-B02", role: "EST", method: "POST", path: "/users", body: foreignUserBody, expect: [403] });
    await run({ id: "NEG-B03", role: "EST", method: "POST", path: "/persons", body: () => qaPersonBody("b03"), expect: [403], revert: async (res) => dropPerson(res)() });
    await run({
        id: "NEG-B04", role: "EST", method: "PUT", path: () => ownPerson && `/persons/${ownPerson}`, expect: [403],
        body: () => ({ ...(snapshotOf.EST ?? {}), phone: "3000000000" }),
        revert: async () => api("PUT", `/persons/${ownPerson}`, { token: sup, body: snapshotOf.EST }),
        check: async (res) =>
            res.status >= 200 && res.status < 300
                ? { verdict: VERDICT.DUDA, note: "el estudiante pudo editar SU PROPIA persona: confirmar si la autoedición es intencional" }
                : judge("forbidden", res, [403], [404]),
    });
    if (compaPerson && sup && !snapCache.has(compaPerson)) {
        const snap = await api("GET", `/persons/${compaPerson}`, { token: sup });
        if (snap.json) snapCache.set(compaPerson, pick(snap.json));
    }
    await run({
        id: "NEG-B04b", role: "EST", method: "PUT", path: () => compaPerson && `/persons/${compaPerson}`, expect: [403], accept: [404],
        body: () => ({ ...(personSnap(compaPerson) ?? {}), phone: "3000000000" }),
        revert: async () => api("PUT", `/persons/${compaPerson}`, { token: sup, body: personSnap(compaPerson) }),
    });
    await run({ id: "NEG-B05", role: "EST", method: "PATCH", path: () => ownUser && `/users/${ownUser}/status?status=false`, expect: [403], revert: async () => revertStatus(ownUser)() });
    await run({ id: "NEG-B06", role: "EST", method: "POST", path: () => ownUser && `/users/${ownUser}/roles`, body: () => ({ roleId: Number(ROL_ADMIN) }), expect: [403], revert: async () => revertRole(ownUser, ROL_ADMIN)() });
    await run({ id: "NEG-B07", role: "EST", method: "POST", path: "/roles", body: { roleName: `QA-B07-${rid}` }, expect: [403], revert: async (res) => api("DELETE", `/roles/${res.json?.roleId ?? res.json?.role_id}`, { token: sup }) });
    await run({ id: "NEG-B08", role: "EST", method: "POST", path: "/schools", body: { code: `QB08${rid}`, name: "QA B08" }, expect: [403] });
    await run({ id: "NEG-B09", role: "EST", method: "POST", path: "/courses", body: () => ({ programId: Number(T.sena.programId), code: `QB09${rid}`, name: "QA", creditHours: 1 }), expect: [403] });
    await run({ id: "NEG-B10", role: "EST", method: "POST", path: "/attendance-records", body: { classSessionId: 1, academicActorId: 1, attendanceStatus: "Present", captureMethod: "MANUAL" }, expect: [403] });
    await run({ id: "NEG-B11", role: "EST", method: "POST", path: "/class-sessions", body: { scheduleBlockId: 1, sessionDate: today }, expect: [403] });
    await run({ id: "NEG-B12", role: "EST", method: "PATCH", path: "/justifications/999999999/review", body: { reviewStatus: "Approved" }, expect: [403], accept: [404] });
    await run({ id: "NEG-B13", role: "EST", method: "DELETE", path: "/justification-types/999999999", expect: [403], accept: [404] });
    await run({ id: "NEG-B14", role: "EST", method: "PUT", path: "/configurations/security/999999999", body: { configurationValue: "1" }, expect: [403], accept: [404] });

    await run({ id: "NEG-B15", role: "DOC", method: "POST", path: "/users", body: foreignUserBody, expect: [403] });
    await run({ id: "NEG-B16", role: "DOC", method: "PATCH", path: () => T.ict.userId && `/users/${T.ict.userId}/status?status=false`, expect: [403], revert: async () => revertStatus(T.ict.userId)() });
    await run({ id: "NEG-B17", role: "DOC", method: "POST", path: () => qa.userId && `/users/${qa.userId}/roles`, body: () => ({ roleId: Number(ROL_ADMIN) }), expect: [403], revert: async () => revertRole(qa.userId, ROL_ADMIN)() });
    await run({ id: "NEG-B18", role: "DOC", method: "POST", path: "/schools", body: { code: `QB18${rid}`, name: "QA B18" }, expect: [403] });
    await run({ id: "NEG-B18b", role: "DOC", method: "POST", path: "/roles", body: { roleName: `QA-B18-${rid}` }, expect: [403], revert: async (res) => api("DELETE", `/roles/${res.json?.roleId ?? res.json?.role_id}`, { token: sup }) });
    await run({ id: "NEG-B18c", role: "DOC", method: "POST", path: "/courses", body: () => ({ programId: Number(T.ict.programId), code: `QB18${rid}`, name: "QA", creditHours: 1 }), expect: [403] });
    // captureMethod: IOT fue renombrado a FINGERPRINT; el valor viejo debe rechazarse.
    const captureBody = (captureMethod) => () => ({ classSessionId: Number(T.sena.sessionId), academicActorId: Number(T.sena.actorId), attendanceStatus: "Present", captureMethod });
    await run({ id: "NEG-E07", role: "DOC", method: "POST", path: () => T.sena.sessionId && "/attendance-records", body: captureBody("IOT"), kind: "invalid", expect: [400], accept: [422] });
    await run({
        id: "NEG-E07b", role: "DOC", method: "POST", path: () => T.sena.sessionId && "/attendance-records", body: captureBody("FINGERPRINT"), kind: "allowed", expect: [201], accept: [400, 409],
        note: "FINGERPRINT es válido; 400/409 = sesión cerrada o registro duplicado (DUDA de datos, no de contrato)",
        revert: async (res) => api("DELETE", `/attendance-records/${res.json?.attendanceRecordId}`, { token: sup }),
    });
    await run({ id: "NEG-B19", role: "DOC", method: "POST", path: "/environments", body: () => ({ schoolId: Number(ict), code: `QB19${rid}`, name: "QA", capacity: 10 }), expect: [403], revert: async (res) => api("DELETE", `/environments/${res.json?.environmentId}`, { token: sup }) });
    await run({ id: "NEG-B20", role: "DOC", method: "PUT", path: "/configurations/academic/999999999", body: { configurationValue: "1" }, expect: [403], accept: [404] });

    await run({ id: "NEG-B22", role: "ADM", method: "POST", path: () => qa.userId && `/users/${qa.userId}/roles`, body: () => ({ roleId: Number(ROL_ADMIN) }), expect: [403], revert: async () => revertRole(qa.userId, ROL_ADMIN)() });
    await run({ id: "NEG-B23", role: "ADM", method: "POST", path: () => qa.userId && `/users/${qa.userId}/roles`, body: () => ({ roleId: Number(ROL_SUPER) }), expect: [403], revert: async () => revertRole(qa.userId, ROL_SUPER)() });
    if (selected("NEG-B24") && sup && qa.userId) {
        await api("POST", `/users/${qa.userId}/roles`, { token: sup, body: { roleId: Number(ROL_ADMIN) } });
        await run({ id: "NEG-B24", role: "ADM", method: "DELETE", path: `/users/${qa.userId}/roles/${ROL_ADMIN}`, expect: [403], revert: async () => api("POST", `/users/${qa.userId}/roles`, { token: sup, body: { roleId: Number(ROL_ADMIN) } }) });
        await api("DELETE", `/users/${qa.userId}/roles/${ROL_ADMIN}`, { token: sup });
    } else if (selected("NEG-B24")) {
        push("NEG-B24", VERDICT.BLOQUEADO, { who: "ADM", note: "sin usuario QA o sin sesión SUP" });
    }
    await run({ id: "NEG-B25", role: "ADM", method: "POST", path: "/schools", body: { code: `QB25${rid}`, name: "QA B25" }, expect: [403] });
    await run({ id: "NEG-B26", role: "ADM", method: "POST", path: "/roles", body: { roleName: `QA-B26-${rid}` }, expect: [403], revert: async (res) => api("DELETE", `/roles/${res.json?.roleId ?? res.json?.role_id}`, { token: sup }) });
    if (selected("NEG-B27") && sup && sessions.ADM && T.sena.programId) {
        const created = await api("POST", "/courses", { token: sessions.ADM.token, body: { programId: Number(T.sena.programId), code: `QB27${rid}`, name: "QA borrar", creditHours: 1 } });
        const cid = created.json?.courseId ?? created.json?.course_id;
        if (cid) {
            cleanups.push(async () => api("DELETE", `/courses/${cid}`, { token: sup }));
            await run({ id: "NEG-B27", role: "ADM", method: "DELETE", path: `/courses/${cid}`, expect: [403] });
        } else {
            push("NEG-B27", VERDICT.BLOQUEADO, { who: "ADM", request: `POST /courses → ${created.status}`, evidence: excerpt(created.text), note: "no se pudo crear el curso QA" });
        }
    } else if (selected("NEG-B27")) {
        push("NEG-B27", VERDICT.BLOQUEADO, { who: "ADM", note: "falta programa SENA o sesión" });
    }
    await run({ id: "NEG-B28", role: "ADM", method: "POST", path: () => qa.userId && `/users/${qa.userId}/roles`, body: () => ({ roleId: Number(ROL_APRENDIZ) }), kind: "allowed", expect: [200, 201, 204], revert: async () => revertRole(qa.userId, ROL_APRENDIZ)() });

    // ── A3 · Aislamiento ─────────────────────────────────────
    const leakCheck = async (id, role, schoolId, route, personKey) => {
        if (!selected(id)) return;
        const token = sessions[role]?.token;
        if (!token) return push(id, VERDICT.BLOQUEADO, { who: role, note: "sin sesión" });
        const by = route === "/users" || route === "/persons" ? "page" : "offset";
        const list = await fetchAll(token, route, { by });
        if (list.status !== 200) {
            return push(id, VERDICT.DUDA, { who: role, request: `GET ${route} → ${list.status}`, evidence: excerpt(list.text) });
        }
        const personIds = [...new Set(list.items.map((i) => i.personId ?? i.person_id).filter(Boolean))];
        let leaks = [];
        for (let i = 0; i < personIds.length; i += 200) {
            const chunk = personIds.slice(i, i + 200);
            leaks.push(...sql(`SELECT DISTINCT a.person_id, a.school_id FROM academic.academic_actor a WHERE a.deleted_at IS NULL AND a.school_id<>${schoolId} AND a.person_id IN (${uuidList(chunk)})`));
        }
        push(id, leaks.length ? VERDICT.FAIL : VERDICT.PASS, {
            who: role, request: `GET ${route} (${list.items.length} filas) → 200`,
            evidence: leaks.length ? `${leaks.length} personas de otra sede, p. ej. ${leaks[0].join("@sede ")}` : "todas de su sede",
            severity: leaks.length ? "Bloqueante" : "",
        });
    };
    const listByField = async (id, role, route, field, ownValue, sqlOf) => {
        if (!selected(id)) return;
        const token = sessions[role]?.token;
        if (!token) return push(id, VERDICT.BLOQUEADO, { who: role, note: "sin sesión" });
        const list = await fetchAll(token, route);
        if (list.status !== 200) return push(id, VERDICT.DUDA, { who: role, request: `GET ${route} → ${list.status}`, evidence: excerpt(list.text) });
        const ids = [...new Set(list.items.map((i) => i[field]).filter((v) => v != null))];
        const foreign = ids.length ? sqlOf(ids).filter((row) => String(row[0]) !== String(ownValue)) : [];
        push(id, foreign.length ? VERDICT.FAIL : VERDICT.PASS, {
            who: role, request: `GET ${route} (${list.items.length} filas) → 200`,
            evidence: foreign.length ? `sedes ajenas: ${foreign.map((r) => r[0]).join(",")}` : "todas de su sede",
            severity: foreign.length ? "Bloqueante" : "",
        });
    };
    const directions = [
        { prefix: "NEG-C", caller: "ADM", mine: sena, theirs: T.ict, theirsId: ict },
        { prefix: "NEG-C17-", caller: "ADM2", mine: ict, theirs: T.sena, theirsId: sena },
    ];
    for (const d of directions) {
        const id = (n) => (d.prefix === "NEG-C" ? `NEG-C${n}` : `${d.prefix}${n}`);
        const t = d.theirs;
        await run({ id: id("01"), role: d.caller, path: () => t.userId && `/users/${t.userId}`, expect: [403], accept: [404] });
        await run({ id: id("02"), role: d.caller, path: () => t.personId && `/persons/${t.personId}`, expect: [403], accept: [404] });
        await run({
            id: id("03"), role: d.caller, method: "PUT", path: () => t.personId && `/persons/${t.personId}`, expect: [403], accept: [404],
            body: () => ({ ...(personSnap(t.personId) ?? {}), phone: "3000000000" }),
            revert: async () => api("PUT", `/persons/${t.personId}`, { token: sup, body: personSnap(t.personId) }),
        });
        await run({ id: id("04"), role: d.caller, method: "PATCH", path: () => t.userId && `/users/${t.userId}/status?status=false`, expect: [403], accept: [404], revert: async () => revertStatus(t.userId)() });
        await leakCheck(id("05"), d.caller, d.mine, "/users");
        await leakCheck(id("06"), d.caller, d.mine, "/persons");
        await run({ id: id("08"), role: d.caller, path: () => t.cohortId && `/cohorts/${t.cohortId}/enrollments`, kind: "forbidden", expect: [403], accept: [404, 200] });
        if (selected(id("09")) && t.cohortId && d.mine) {
            const mineT = d.prefix === "NEG-C" ? T.sena : T.ict;
            await run({
                id: id("09"), role: d.caller, method: "POST", path: "/enrollments", expect: [403], accept: [404, 400],
                body: () => ({ academicActorId: Number(mineT.actorId), cohortId: Number(t.cohortId), enrolledOn: today, enrollmentStatus: "Active" }),
                revert: async (res) => api("DELETE", `/enrollments/${res.json?.enrollmentId ?? res.json?.enrollment_id ?? res.json?.id}`, { token: sup }),
            });
        }
        await listByField(id("10"), d.caller, "/environments", "environmentId", d.mine, (ids) => sql(`SELECT DISTINCT school_id FROM scheduling.environment WHERE environment_id IN (${ids.map(Number).join(",")})`));
        await listByField(id("11"), d.caller, "/schedule-blocks", "cohortId", d.mine, (ids) => sql(`SELECT DISTINCT p.school_id FROM academic.cohort c JOIN academic.program p ON p.program_id=c.program_id WHERE c.cohort_id IN (${ids.map(Number).join(",")})`));
        await run({ id: id("12"), role: d.caller, path: () => d.theirsId && `/schools/${d.theirsId}/actors`, expect: [403], accept: [404] });
        await run({
            id: id("13"), role: d.caller, path: () => t.sessionId && `/class-sessions/${t.sessionId}/attendance`, expect: [403], accept: [404],
            check: async (res) => {
                if (res.status < 200 || res.status >= 300) return judge("forbidden", res, [403], [404]);
                const list = Array.isArray(res.json) ? res.json : res.json?.data ?? res.json?.content ?? [];
                return list.length
                    ? { verdict: VERDICT.FAIL, severity: "Bloqueante", note: `${list.length} registros de otra sede` }
                    : { verdict: VERDICT.DUDA, note: "200 con lista vacía: el servicio no valida el alcance, pero no hay datos que filtrar en esa sesión" };
            },
        });
        await run({ id: id("14"), role: d.caller, path: () => t.personId && `/biometric/facial/${t.personId}`, expect: [403], accept: [404] });
        await listByField(id("15"), d.caller, "/alerts", "academicActorId", d.mine, (ids) => sql(`SELECT DISTINCT school_id FROM academic.academic_actor WHERE academic_actor_id IN (${ids.map(Number).join(",")})`));
    }
    // Docente / estudiante hacia otras sedes y compañeros
    const foreignForDoc = T.sena.userId ? T.sena : T3;
    await run({ id: "NEG-C18", role: "DOC", path: () => foreignForDoc.personId && `/persons/${foreignForDoc.personId}`, expect: [403], accept: [404] });
    await run({ id: "NEG-C19", role: "DOC", path: () => foreignForDoc.actorId && `/academic-actors/${foreignForDoc.actorId}/attendance`, expect: [403], accept: [404] });
    await run({ id: "NEG-C22", role: "EST", path: () => compaActor && `/academic-actors/${compaActor}/attendance`, expect: [403], accept: [404] });
    await run({
        id: "NEG-C23", role: "EST", path: () => ownActor && `/academic-actors/${ownActor}/attendance`, kind: "allowed", expect: [200],
        check: async (res) => {
            const base = judge("allowed", res, [200]);
            if (base.verdict !== VERDICT.PASS) return base;
            const list = Array.isArray(res.json) ? res.json : res.json?.content ?? [];
            const foreign = list.filter((r) => String(r.academicActorId ?? r.academic_actor_id) !== String(ownActor));
            return foreign.length ? { verdict: VERDICT.FAIL, severity: "Bloqueante", note: `${foreign.length} registros ajenos` } : { verdict: VERDICT.PASS, note: `${list.length} registros propios` };
        },
    });
    await run({ id: "NEG-C24", role: "EST", path: () => compaPerson && `/persons/${compaPerson}`, expect: [403], accept: [404] });
    if (selected("NEG-C27") && sup) {
        const list = await fetchAll(sup, "/users", { by: "page" });
        const ids = [...new Set(list.items.map((i) => i.personId ?? i.person_id).filter(Boolean))];
        const schools = new Set();
        for (let i = 0; i < ids.length; i += 200) {
            sql(`SELECT DISTINCT school_id FROM academic.academic_actor WHERE deleted_at IS NULL AND person_id IN (${uuidList(ids.slice(i, i + 200))})`).forEach((r) => schools.add(r[0]));
        }
        push("NEG-C27", schools.size >= 2 ? VERDICT.PASS : VERDICT.FAIL, { who: "SUP", request: `GET /users (${list.items.length}) → ${list.status}`, evidence: `${schools.size} sedes visibles`, severity: schools.size >= 2 ? "" : "Alta" });
    }

    // ── A4 · Validación de entrada (rol ADM salvo indicación) ─
    const post = (id, route, body, extra = {}) => run({ id, role: "ADM", method: "POST", path: route, body, kind: "invalid", expect: [400], accept: [422], revert: async (res) => dropPerson(res)(), ...extra });
    await post("NEG-D01", "/persons", () => ({ ...qaPersonBody("d01"), name: undefined }));
    await post("NEG-D02", "/persons", () => ({ ...qaPersonBody("d02"), documentType: "XX" }));
    await post("NEG-D03", "/persons", () => ({ ...qaPersonBody("d03"), bloodType: "Z+" }));
    await post("NEG-D04", "/persons", () => ({ ...qaPersonBody("d04"), email: "sin-arroba" }));
    if (sessions.ADM) {
        const base = await api("POST", "/persons", { token: sessions.ADM.token, body: qaPersonBody("d05") });
        const basePerson = base.json;
        if (basePerson) cleanups.push(async () => api("PATCH", `/persons/${basePerson.personId ?? basePerson.person_id}/status?status=false`, { token: sup }));
        await post("NEG-D05", "/persons", () => ({ ...qaPersonBody("d05b"), documentType: basePerson?.documentType ?? "CC", documentNumber: basePerson?.documentNumber }), { expect: [409], accept: [400], skip: basePerson ? undefined : "no se pudo crear la persona base" });
        await post("NEG-D06", "/persons", () => ({ ...qaPersonBody("d06"), email: basePerson?.email }), { expect: [409], accept: [400], skip: basePerson ? undefined : "no se pudo crear la persona base" });
    }
    await post("NEG-D07", "/persons", () => ({ ...qaPersonBody("d07"), name: "A".repeat(10000) }), { accept: [413, 422] });
    await run({
        id: "NEG-D08", role: "ADM", method: "POST", path: "/persons", body: () => ({ ...qaPersonBody("d08"), name: "<script>alert(1)</script>" }),
        kind: "allowed", expect: [200, 201, 400], revert: async (res) => dropPerson(res)(),
        check: async (res) => (res.status === 400 || (res.status >= 200 && res.status < 300) ? { verdict: VERDICT.PASS, note: res.status === 400 ? "rechazado" : "guardado como texto: verificar B/NEG-F04 en pantalla" } : judge("invalid", res, [400])),
    });
    await post("NEG-D09", "/persons", undefined, { rawBody: '{"name":', headers: { "Content-Type": "application/json" } });
    await post("NEG-D10", "/persons", undefined, { rawBody: "name=QA", headers: { "Content-Type": "text/plain" }, expect: [400, 415], accept: [422] });
    await post("NEG-D11", "/users", () => ({ personId: qa.personId, username: `qa.d11.${rid}`, password: "abc", authenticationType: "Local" }), { skip: qa.personId ? undefined : "sin persona QA", revert: undefined });
    await post("NEG-D12", "/users", () => ({ personId: qa.personId, username: `qa.${rid}`, password: "Qa12345678!x", authenticationType: "Local" }), { expect: [409], accept: [400], skip: qa.userId ? undefined : "sin usuario QA", revert: undefined });
    await post("NEG-D13", "/users", () => ({ personId: "00000000-0000-4000-8000-0000000000aa", username: `qa.d13.${rid}`, password: "Qa12345678!x", authenticationType: "Local" }), { expect: [404], accept: [400, 403], revert: undefined });
    await post("NEG-D14", "/users", () => ({ personId: qa.personId, username: `qa.d14.${rid}`, password: "Qa12345678!x", authenticationType: "Local" }), { expect: [409], accept: [400], skip: qa.userId ? undefined : "sin usuario QA", revert: undefined });
    await run({ id: "NEG-D15", role: "ADM", path: "/persons/not-a-uuid", kind: "invalid", expect: [400], accept: [404] });
    await run({ id: "NEG-D16", role: "ADM", path: "/persons/00000000-0000-4000-8000-0000000000bb", kind: "invalid", expect: [404], accept: [403] });
    await run({ id: "NEG-D17", role: "ADM", path: "/courses/99999999", kind: "invalid", expect: [404], accept: [403] });
    await run({ id: "NEG-D18", role: "ADM", path: "/academic-actors?limit=-1", kind: "allowed", expect: [200, 400] });
    await run({
        id: "NEG-D19", role: "ADM", path: "/academic-actors?limit=100000", kind: "allowed", expect: [200, 400],
        check: async (res) => {
            const base = judge("allowed", res, [200, 400]);
            const n = Array.isArray(res.json) ? res.json.length : res.json?.content?.length ?? 0;
            return base.verdict === VERDICT.PASS && n > 100 ? { verdict: VERDICT.FAIL, severity: "Media", note: `devolvió ${n} filas (> 100)` } : base;
        },
    });
    await run({ id: "NEG-D20", role: "ADM", path: "/academic-actors?offset=-5", kind: "allowed", expect: [200, 400] });
    await run({ id: "NEG-D21", role: "ADM", path: `/persons?q=${encodeURIComponent("' OR 1=1 --")}`, kind: "allowed", expect: [200, 400] });
    await post("NEG-D22", "/academic-periods", () => ({ schoolId: Number(sena), name: `QA-D22-${rid}`, startsOn: "2026-12-31", endsOn: "2026-01-01", isActive: false }), { revert: async () => {} });
    await post("NEG-D23", "/courses", () => ({ programId: Number(T.sena.programId), code: sql(`SELECT code FROM academic.course WHERE course_id=${T.sena.courseId}`)[0]?.[0], name: "QA dup", creditHours: 1 }), { expect: [409], accept: [400], skip: T.sena.courseId ? undefined : "sin curso SENA" });
    const dropEnv = async (res) => api("DELETE", `/environments/${res.json?.environmentId ?? res.json?.environment_id}`, { token: sup });
    await post("NEG-D24", "/environments", () => ({ schoolId: Number(sena), code: `QD24${rid}`, name: "QA", capacity: 0 }), { revert: dropEnv });
    await post("NEG-D25", "/environments", () => ({ schoolId: Number(sena), code: `QD25${rid}`, name: "QA", capacity: -5 }), { revert: dropEnv });
    const blk = T.sena.block;
    const blockBody = (over) => ({ cohortId: Number(blk?.cohortId), courseId: Number(blk?.courseId), environmentId: Number(blk?.environmentId), instructorActorId: Number(blk?.instructorActorId), dayOfWeek: Number(blk?.dayOfWeek), startsAt: blk?.startsAt, endsAt: blk?.endsAt, ...over });
    const noBlock = blk ? undefined : "sin bloque horario de la sede";
    await post("NEG-D26", "/schedule-blocks", () => blockBody({ dayOfWeek: 8 }), { skip: noBlock, revert: async () => {} });
    await post("NEG-D27", "/schedule-blocks", () => blockBody({ startsAt: "10:00:00", endsAt: "09:00:00", dayOfWeek: 6 }), { skip: noBlock, revert: async () => {} });
    await post("NEG-D28", "/schedule-blocks", () => blockBody({ instructorActorId: Number(blk.instructorActorId) + 100000 }), { expect: [409], accept: [400, 404], skip: noBlock, revert: async () => {} });
    await post("NEG-D29", "/schedule-blocks", () => blockBody({ environmentId: Number(blk.environmentId) + 100000 }), { expect: [409], accept: [400, 404], skip: noBlock, revert: async () => {} });
    const enr = sql(`SELECT e.academic_actor_id, e.cohort_id FROM academic.enrollment e JOIN academic.cohort c ON c.cohort_id=e.cohort_id JOIN academic.program p ON p.program_id=c.program_id WHERE p.school_id=${sena ?? 0} AND e.deleted_at IS NULL LIMIT 1`)[0];
    await post("NEG-D30", "/enrollments", () => ({ academicActorId: Number(enr[0]), cohortId: Number(enr[1]), enrolledOn: today, enrollmentStatus: "Active" }), { expect: [409], accept: [400], skip: enr ? undefined : "sin matrícula SENA", revert: async () => {} });
    await run({ id: "NEG-D31", role: "ADM", skip: "requiere captura biométrica real (L3)", path: "/" });
    const schoolCode = sqlOne(`SELECT code FROM academic.school WHERE school_id=${sena ?? 0}`);
    await run({ id: "NEG-D32", role: "SUP", method: "POST", path: "/schools", body: { code: schoolCode, name: "QA dup" }, kind: "invalid", expect: [409], accept: [400] });
    const jtName = sqlOne(`SELECT name FROM attendance.justification_type WHERE school_id IS NULL AND deleted_at IS NULL LIMIT 1`);
    await run({ id: "NEG-D33", role: "SUP", method: "POST", path: "/justification-types", body: { name: jtName, requiresAttachment: false, status: true }, kind: "invalid", expect: [409], accept: [400], skip: jtName ? undefined : "no hay tipo global" });

    // ── A5 · Estado y reglas ─────────────────────────────────
    await run({ id: "NEG-E15", role: "ADM", method: "PATCH", path: () => qa.userId && `/users/${qa.userId}/status?status=abc`, kind: "invalid", expect: [400] });
    await run({
        id: "NEG-E16", role: "ADM", method: "PUT", path: () => qa.personId && `/persons/${qa.personId}`, kind: "allowed", expect: [200, 204],
        body: () => ({ documentNumber: qa.person?.documentNumber, name: "QA", lastName: "Matriz", email: qa.person?.email, phone: "3001112222" }),
        check: async (res) => {
            const first = judge("allowed", res, [200, 204]);
            if (first.verdict !== VERDICT.PASS) return first;
            const again = await api("PUT", `/persons/${qa.personId}`, { token: sessions.ADM.token, body: { documentNumber: qa.person?.documentNumber, name: "QA", lastName: "Matriz", email: qa.person?.email, phone: "3001112222" } });
            return again.status === 200 || again.status === 204 ? { verdict: VERDICT.PASS, note: "idempotente" } : { verdict: VERDICT.FAIL, severity: "Media", note: `segundo PUT → ${again.status}` };
        },
    });
    if (selected("NEG-E20") && sup && T.sena.programId) {
        const created = await api("POST", "/courses", { token: sup, body: { programId: Number(T.sena.programId), code: `QE20${rid}`, name: "QA borrado lógico", creditHours: 1 } });
        const cid = created.json?.courseId ?? created.json?.course_id;
        if (!cid) {
            push("NEG-E20", VERDICT.BLOQUEADO, { who: "SUP", request: `POST /courses → ${created.status}`, evidence: excerpt(created.text), note: "no se pudo crear el curso QA" });
        } else {
            const del = await api("DELETE", `/courses/${cid}`, { token: sup });
            const row = sql(`SELECT (deleted_at IS NOT NULL) FROM academic.course WHERE course_id=${Number(cid)}`)[0]?.[0];
            push("NEG-E20", del.status >= 200 && del.status < 300 && row === "t" ? VERDICT.PASS : row === undefined ? VERDICT.FAIL : VERDICT.DUDA, {
                who: "SUP", request: `DELETE /courses/${cid} → ${del.status}`, evidence: row === undefined ? "la fila desapareció (borrado físico)" : `deleted_at lleno: ${row}`,
                severity: row === undefined ? "Alta" : "",
            });
        }
    }

    await runCleanups();
}

// Instantáneas de personas para poder revertir PUT prohibidos que llegaran a ejecutarse.
const snapshotOf = {};
const snapCache = new Map();
function personSnap(personId) {
    return snapCache.get(personId) ?? null;
}
async function takeSnapshots() {
    const sup = sessions.SUP?.token;
    if (!sup) return;
    const own = sessions.EST
        ? sql(`SELECT p.person_id FROM identity.app_user u JOIN identity.person p ON p.person_id=u.person_id WHERE u.username='${ROLE_USERS.EST}' LIMIT 1`)[0]?.[0]
        : null;
    const ids = [own, ...[ROLE_USERS.ADM, ROLE_USERS.ADM2].map((u) => sqlOne(`SELECT a.school_id FROM identity.app_user x JOIN academic.academic_actor a ON a.person_id=x.person_id WHERE x.username='${u}' LIMIT 1`))].filter(Boolean);
    void ids;
    for (const school of [schoolOf(ROLE_USERS.ADM), schoolOf(ROLE_USERS.ADM2)]) {
        const t = targetsOf(school);
        if (t.personId) {
            const res = await api("GET", `/persons/${t.personId}`, { token: sup });
            if (res.json) snapCache.set(t.personId, pick(res.json));
        }
    }
    if (own) {
        const res = await api("GET", `/persons/${own}`, { token: sup });
        if (res.json) snapshotOf.EST = pick(res.json);
    }
}
const pick = (p) => ({ documentNumber: p.documentNumber, name: p.name, lastName: p.lastName, email: p.email, phone: p.phone ?? null });

// ── Cobertura contra el documento ────────────────────────────

function documentIds() {
    const text = readFileSync(path.join(REVISION_DIR, "05-negativos.md"), "utf8");
    const part = text.split("## B. Casos de interfaz")[0];
    return [...part.matchAll(/^\| (NEG-[A-E]\d{2}) \|/gm)].map((m) => m[1]);
}

(async () => {
    const started = Date.now();
    try {
        await setup();
        await takeSnapshots();
        // setup() se vuelve a invocar dentro de main(): reutiliza las sesiones ya iniciadas.
        await main();
    } catch (error) {
        results.push({ id: "L1-ERROR", verdict: VERDICT.FAIL, who: "script", request: "", evidence: String(error?.stack ?? error).slice(0, 220), severity: "Alta", note: "el script falló; revisar" });
        await runCleanups();
    }
    const known = new Set([...covered, ...results.map((r) => r.id.replace(/^(NEG-C17)-.*/, "$1"))]);
    if (!only.length) {
        for (const id of documentIds()) {
            if (!known.has(id) && !results.some((r) => r.id === id)) {
                push(id, VERDICT.BLOQUEADO, { who: "—", note: "no cubierto por L1 (requiere datos o acción manual): se revisa en L3" });
            }
        }
    }
    results.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
    const totals = writeReport("L1-api", "L1 · Matriz de API (casos negativos)", results, { Duración: `${Math.round((Date.now() - started) / 1000)} s`, API });
    console.log(`L1 API: ${totals.PASS} PASS · ${totals.FAIL} FAIL · ${totals.DUDA} DUDA · ${totals.BLOQUEADO} BLOQUEADO`);
    for (const r of results.filter((x) => x.verdict === VERDICT.FAIL)) {
        console.log(`  FAIL ${r.id} [${r.severity || "-"}] ${r.request} ${r.note}`);
    }
    process.exit(totals.FAIL > 0 ? 1 : 0);
})();
