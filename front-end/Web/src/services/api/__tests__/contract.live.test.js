/**
 * Contrato web ⇄ endpoint ⇄ base de datos, contra el stack local (docker compose).
 *
 * Por cada operación se comparan tres cosas:
 *   1. la petición que arma la web (el cuerpo real que sale por fetch, capturado),
 *   2. la respuesta del endpoint,
 *   3. la fila que queda en PostgreSQL (consultada con docker exec psql).
 *
 * Usa las mismas funciones de servicio que la web (academicApi, courseCreation,
 * environmentManagement). No corre con `jest` normal: necesita el stack levantado.
 *
 *   LIVE_CONTRACT=1 npx jest src/services/api/__tests__/contract.live.test.js
 *
 * Cuentas: ADM (Admin de sede) en ../.cuentas.qa y el super admin en ../.cuentas.local
 * (raíz del repo, sin versionar). Nada de lo creado se deja: se borra al terminar.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import http from "node:http";

const LIVE = process.env.LIVE_CONTRACT === "1";
const run = LIVE ? describe : describe.skip;

const ROOT = path.resolve(__dirname, "../../../../../../..");
const API = process.env.QA_GATEWAY_URL ?? "http://localhost:8000";
const PG_CONTAINER = process.env.QA_PG_CONTAINER ?? "faceattend-postgres";

// ── utilidades ───────────────────────────────────────────────

function readCredentials(file, matcher) {
    const p = path.join(ROOT, file);
    if (!existsSync(p)) return null;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
        if (!line || line.startsWith("#")) continue;
        const [key, ...rest] = line.split("=");
        if (matcher(key.trim())) {
            const value = rest.join("=").trim();
            if (key.trim() === "ADM") {
                const i = value.indexOf(":");
                return { identifier: value.slice(0, i), password: value.slice(i + 1) };
            }
            return { identifier: key.trim(), password: value };
        }
    }
    return null;
}

/** Una fila (o varias) como JSON, sin depender del formato de psql. */
function sql(query) {
    const out = execFileSync(
        "docker",
        ["exec", "-e", "Q", PG_CONTAINER, "sh", "-c", `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$Q"`],
        { env: { ...process.env, Q: `select coalesce(json_agg(t), '[]') from (${query}) t` }, encoding: "utf8" }
    );
    return JSON.parse(out.trim());
}
function exec(statement) {
    execFileSync(
        "docker",
        ["exec", "-e", "Q", PG_CONTAINER, "sh", "-c", `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -c "$Q"`],
        { env: { ...process.env, Q: statement }, encoding: "utf8" }
    );
}
const one = (query) => sql(query)[0] ?? null;
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

const pick = (o, ...keys) => keys.map((k) => o?.[k]).find((v) => v !== undefined && v !== null);

// jsdom no trae fetch: este lo sustituye con node:http (solo lo que usa apiClient: status, ok, text).
function nodeFetch(url, init = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, text: async () => text });
            });
        });
        req.on('error', reject);
        init.signal?.addEventListener('abort', () => req.destroy(new Error('aborted')));
        if (init.body) req.write(init.body);
        req.end();
    });
}

// Captura lo que la web manda y lo que el endpoint contesta.
const wire = [];
function installFetchSpy() {
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        const res = await nodeFetch(url, init);
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* sin JSON */ }
        wire.push({
            method: init.method ?? 'GET',
            url: String(url),
            request: init.body ? JSON.parse(init.body) : undefined,
            status: res.status,
            response: json,
        });
        return res;
    };
    return () => { globalThis.fetch = real; };
}
const lastWire = () => wire[wire.length - 1];

async function loginAs(creds) {
    const { authApi } = require("../authApi");
    const { saveToken, clearToken } = require("../../../api/apiClient");
    await clearToken();
    const session = await authApi.login({ email: creds.identifier, password: creds.password });
    const sessionId = pick(session, "sessionId", "session_id", "id");
    if (!sessionId) throw new Error("login sin sessionId");
    await saveToken(String(sessionId), { email: creds.identifier });
    return session;
}

const rid = Math.random().toString(36).slice(2, 8).toUpperCase();

// ── pruebas ──────────────────────────────────────────────────

run("contrato web ⇄ endpoint ⇄ BD (stack local)", () => {
    let restoreFetch;
    let academicApi;
    let courseCreation;
    let environmentManagement;
    const superAdmin = readCredentials(".cuentas.local", (k) => k === "admin.faceattend");
    const siteAdmin = readCredentials(".cuentas.qa", (k) => k === "ADM");
    const createdSchoolIds = [];
    const createdProgramIds = [];
    const createdCourseIds = [];
    const createdEnvIds = [];

    beforeAll(() => {
        process.env.EXPO_PUBLIC_SESSION_MODE = "bearer";
        window.__FACEATTEND_API_URL__ = API;
        restoreFetch = installFetchSpy();
        ({ academicApi } = require("../academicApi"));
        courseCreation = require("../courseCreation");
        environmentManagement = require("../environmentManagement");
    });

    afterAll(() => {
        restoreFetch?.();
    });

    test("hay cuentas y base de datos accesibles", () => {
        expect(superAdmin).not.toBeNull();
        expect(siteAdmin).not.toBeNull();
        expect(one(`select 1 as ok`)).toEqual({ ok: 1 });
    });

    describe("Super Administrador gestiona escuelas", () => {
        let schoolId;
        const payload = {
            name: `CT Sede ${rid}`,
            code: `CT${rid}`,
            address: "Calle 10 # 20-30",
            cityName: "Medellín",
            phone: "6041112222",
            email: `ct.${rid.toLowerCase()}@example.test`,
        };

        beforeAll(async () => { await loginAs(superAdmin); });

        test("POST /schools: respuesta y BD reflejan lo que mandó la web", async () => {
            const created = await academicApi.createSchool(payload);
            const w = lastWire();
            schoolId = pick(created, "schoolId", "school_id", "id");
            createdSchoolIds.push(schoolId);

            expect(w.status).toBe(201);
            expect(w.request).toEqual(payload);
            expect(created).toMatchObject({
                code: payload.code,
                name: payload.name,
                address: payload.address,
                phone: payload.phone,
                email: payload.email,
            });
            expect(pick(created, "cityName", "city_name")).toBe(payload.cityName);

            const row = one(`select * from academic.school where school_id = ${Number(schoolId)}`);
            expect(row).toMatchObject({
                code: payload.code,
                name: payload.name,
                address: payload.address,
                city_name: payload.cityName,
                phone: payload.phone,
                email: payload.email,
                status: true,
                deleted_at: null,
            });
            expect(Number(row.row_version)).toBeGreaterThanOrEqual(1);
        });

        test("PUT /schools/:id: solo cambia lo enviado y la BD coincide", async () => {
            const patch = { name: `CT Sede ${rid} editada`, phone: "6043334444" };
            const updated = await academicApi.updateSchool(schoolId, patch);
            const w = lastWire();
            expect(w.status).toBe(200);
            expect(w.request).toEqual(patch);
            expect(updated).toMatchObject(patch);

            const row = one(`select * from academic.school where school_id = ${Number(schoolId)}`);
            expect(row).toMatchObject({ ...patch, code: payload.code, address: payload.address, email: payload.email });
        });

        test("PATCH /schools/:id/status desactiva y la BD queda status=false", async () => {
            await academicApi.updateSchoolStatus(schoolId, false);
            const w = lastWire();
            expect(w.request).toEqual({ status: false });
            expect(w.status).toBe(200);
            expect(one(`select status from academic.school where school_id = ${Number(schoolId)}`).status).toBe(false);
        });

        test("DELETE /schools/:id es borrado lógico: la fila sigue con deleted_at", async () => {
            await academicApi.deleteSchool(schoolId);
            expect(lastWire().status).toBe(204);
            const row = one(`select deleted_at from academic.school where school_id = ${Number(schoolId)}`);
            expect(row).not.toBeNull();
            expect(row.deleted_at).not.toBeNull();
        });
    });

    describe("Administrador de sede solo maneja su propia sede", () => {
        let own;
        let other;

        beforeAll(async () => {
            await loginAs(siteAdmin);
            const list = await academicApi.listSchools();
            const rows = Array.isArray(list) ? list : list?.content ?? [];
            expect(rows).toHaveLength(1); // nunca la lista completa
            own = rows[0];
            other = one(
                `select school_id, code, name from academic.school
                  where deleted_at is null and school_id <> ${Number(pick(own, "schoolId", "school_id"))} limit 1`
            );
        });

        test("GET /schools devuelve exactamente la sede que tiene en BD", () => {
            const id = Number(pick(own, "schoolId", "school_id"));
            const row = one(`select * from academic.school where school_id = ${id}`);
            expect(own).toMatchObject({ code: row.code, name: row.name });
        });

        test("POST /schools → 403 y no se crea nada en BD", async () => {
            const code = `CTX${rid}`;
            await expect(
                academicApi.createSchool({ name: `CT intruso ${rid}`, code })
            ).rejects.toMatchObject({ status: 403 });
            expect(lastWire().request).toEqual({ name: `CT intruso ${rid}`, code });
            expect(one(`select 1 as n from academic.school where code = ${lit(code)}`)).toBeNull();
        });

        test("PUT de su sede cambia nombre y contacto, y la BD lo refleja", async () => {
            const id = Number(pick(own, "schoolId", "school_id"));
            const before = one(`select * from academic.school where school_id = ${id}`);
            const patch = { name: `${before.name}`, phone: "6045556666" };
            const updated = await academicApi.updateSchool(id, patch);
            expect(lastWire().request).toEqual(patch);
            expect(updated.phone).toBe(patch.phone);
            const after = one(`select * from academic.school where school_id = ${id}`);
            expect(after.phone).toBe(patch.phone);
            expect(after.code).toBe(before.code);
            expect(after.status).toBe(before.status);
            // restaura el teléfono original
            await academicApi.updateSchool(id, { phone: before.phone ?? undefined });
        });

        test.each([
            ["code", { code: `CTC${rid}` }],
            ["status", { status: false }],
            ["cityId", { cityId: 99 }],
        ])("PUT cambiando %s → 403 y la BD no cambia", async (_field, patch) => {
            const id = Number(pick(own, "schoolId", "school_id"));
            const before = one(`select * from academic.school where school_id = ${id}`);
            await expect(academicApi.updateSchool(id, patch)).rejects.toMatchObject({ status: 403 });
            expect(lastWire().request).toEqual(patch);
            expect(one(`select * from academic.school where school_id = ${id}`)).toEqual(before);
        });

        test("PUT / PATCH status / DELETE de OTRA sede no pasan y la BD no cambia", async () => {
            if (!other) return; // sin segunda sede no hay qué comparar
            const before = one(`select * from academic.school where school_id = ${Number(other.school_id)}`);
            await expect(academicApi.updateSchool(other.school_id, { name: "x" })).rejects.toMatchObject({ status: 404 });
            await expect(academicApi.updateSchoolStatus(other.school_id, false)).rejects.toMatchObject({ status: 403 });
            await expect(academicApi.deleteSchool(other.school_id)).rejects.toMatchObject({ status: 403 });
            expect(one(`select * from academic.school where school_id = ${Number(other.school_id)}`)).toEqual(before);
        });

        describe("programa, curso y ambiente de su sede", () => {
            let schoolId;
            let programId;

            beforeAll(() => { schoolId = Number(pick(own, "schoolId", "school_id")); });

            test("createProgram: petición de la web = respuesta = fila", async () => {
                const body = { schoolId, code: `CTP${rid}`, name: `CT Programa ${rid}` };
                const created = await courseCreation.createProgram(body);
                const w = lastWire();
                programId = created.programId;
                createdProgramIds.push(programId);
                expect(w.status).toBe(201);
                expect(w.request).toEqual({ ...body, status: true });
                const row = one(`select * from academic.program where program_id = ${Number(programId)}`);
                expect(row).toMatchObject({ school_id: schoolId, code: body.code, name: body.name, status: true, deleted_at: null });
            });

            test("createCourse: payload, respuesta y fila (incl. credit_hours)", async () => {
                const created = await courseCreation.createCourse({
                    programId, code: `CTC${rid}`, name: `CT Curso ${rid}`, creditHours: 4,
                });
                const w = lastWire();
                const courseId = pick(created, "courseId", "course_id", "id");
                createdCourseIds.push(courseId);
                expect(w.status).toBe(201);
                expect(w.request).toEqual({ programId, code: `CTC${rid}`, name: `CT Curso ${rid}`, status: true, creditHours: 4 });
                expect(pick(created, "creditHours", "credit_hours")).toBe(4);
                const row = one(`select * from academic.course where course_id = ${Number(courseId)}`);
                expect(row).toMatchObject({
                    program_id: programId, code: `CTC${rid}`, name: `CT Curso ${rid}`, credit_hours: 4, status: true, deleted_at: null,
                });
            });

            test("createEnvironment: la web manda lo que queda en scheduling.environment", async () => {
                const env = await environmentManagement.createEnvironment({
                    schoolId, code: `CTE${rid}`, name: `CT Ambiente ${rid}`, capacity: 25,
                });
                const w = lastWire();
                createdEnvIds.push(env.id);
                expect(w.status).toBe(201);
                expect(w.request).toEqual({ schoolId, code: `CTE${rid}`, name: `CT Ambiente ${rid}`, capacity: 25, status: true });
                expect(env).toMatchObject({ number: `CTE${rid}`, description: `CT Ambiente ${rid}`, capacity: 25 });
                const row = one(`select * from scheduling.environment where environment_id = ${Number(env.id)}`);
                expect(row).toMatchObject({
                    school_id: schoolId, code: `CTE${rid}`, name: `CT Ambiente ${rid}`, capacity: 25, status: true, deleted_at: null,
                });
            });

            test("el auditado queda completo en las filas creadas", () => {
                const ids = { program: createdProgramIds[0], course: createdCourseIds[0], env: createdEnvIds[0] };
                for (const [table, col, id] of [
                    ["academic.program", "program_id", ids.program],
                    ["academic.course", "course_id", ids.course],
                    ["scheduling.environment", "environment_id", ids.env],
                ]) {
                    const row = one(`select created_at, updated_at, row_version from ${table} where ${col} = ${Number(id)}`);
                    expect(row.created_at).toBeTruthy();
                    expect(row.updated_at).toBeTruthy();
                    expect(Number(row.row_version)).toBeGreaterThanOrEqual(1);
                }
            });

            test('DELETE /environments/:id es borrado lógico (la fila queda con deleted_at)', async () => {
                const id = Number(createdEnvIds[0]);
                await environmentManagement.deleteEnvironment(id);
                expect(lastWire().status).toBe(204);
                const row = one(`select deleted_at from scheduling.environment where environment_id = ${id}`);
                expect(row).not.toBeNull(); // hoy el servicio la borra físicamente
                expect(row.deleted_at).not.toBeNull();
            });

            afterAll(() => {
                // El Admin de sede no borra cursos ni programas (solo Super Admin): se limpian por SQL.
                for (const id of createdCourseIds) exec(`update academic.course set deleted_at = now(), status = false where course_id = ${Number(id)}`);
                for (const id of createdProgramIds) exec(`update academic.program set deleted_at = now(), status = false where program_id = ${Number(id)}`);
            });
        });
    });
});
