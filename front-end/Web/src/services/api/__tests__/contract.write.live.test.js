/**
 * Contrato web ⇄ endpoint ⇄ BD, ESCRITURAS, contra el stack local (docker compose).
 *
 * Por cada operación se comparan: (1) la petición que arma la web (el cuerpo real que sale por
 * fetch, capturado), (2) la respuesta del endpoint y (3) la fila que queda en PostgreSQL.
 * Usa las mismas funciones de servicio que la web. No corre con `jest` normal:
 *
 *   node verificar-contrato.mjs        (o: LIVE_CONTRACT=1 npx jest --runInBand src/services/api/__tests__/contract.*.live.test.js)
 *
 * Cuentas: ADM (Admin de sede) en .cuentas.qa y el super admin en .cuentas.local (raíz del repo,
 * sin versionar). Lo creado lleva el prefijo CT y se borra lógicamente al terminar.
 */
import {
    LIVE, bootWeb, exec, flushReport, lastWire, lit, loginAs, one, pick, readCredentials, rid, scenario,
} from "../testing/contractHarness";

const run = LIVE ? describe : describe.skip;
const G = "Escrituras";

/** Espera que la promesa falle con uno de esos HTTP; devuelve el error. */
async function rejected(promise, statuses) {
    let error;
    try { await promise; } catch (e) { error = e; }
    if (!error) throw new Error(`se esperaba un rechazo ${statuses.join("/")} y la operación tuvo éxito`);
    if (!statuses.includes(error.status)) throw new Error(`se esperaba ${statuses.join("/")} y llegó ${error.status}: ${error.message}`);
    return error;
}

run("contrato web ⇄ endpoint ⇄ BD: escrituras", () => {
    let restoreFetch;
    let academicApi;
    let courseCreation;
    let fichaCreation;
    let environmentManagement;
    const superAdmin = readCredentials(".cuentas.local", "admin.faceattend");
    const siteAdmin = readCredentials(".cuentas.qa", "ADM");
    const created = { schools: [], programs: [], courses: [], periods: [], cohorts: [], envs: [], enrollments: [], blocks: [] };

    beforeAll(() => {
        restoreFetch = bootWeb();
        ({ academicApi } = require("../academicApi"));
        courseCreation = require("../courseCreation");
        fichaCreation = require("../fichaCreation");
        environmentManagement = require("../environmentManagement");
    });

    afterAll(() => {
        // Lo que el Admin de sede no puede borrar por diseño se limpia por SQL, de forma lógica.
        const mark = (table, col, ids) => ids.filter(Boolean).forEach((id) =>
            exec(`update ${table} set deleted_at = now() where ${col} = ${Number(id)} and deleted_at is null`));
        mark("scheduling.schedule_block", "schedule_block_id", created.blocks);
        mark("scheduling.environment", "environment_id", created.envs);
        mark("academic.enrollment", "enrollment_id", created.enrollments);
        mark("academic.cohort", "cohort_id", created.cohorts);
        mark("academic.academic_period", "academic_period_id", created.periods);
        mark("academic.course", "course_id", created.courses);
        mark("academic.program", "program_id", created.programs);
        mark("academic.school", "school_id", created.schools);
        flushReport("write");
        restoreFetch?.();
    });

    test("hay cuentas y base de datos accesibles", () => {
        expect(superAdmin).not.toBeNull();
        expect(siteAdmin).not.toBeNull();
        expect(one(`select 1 as ok`)).toEqual({ ok: 1 });
    });

    // ── Super Administrador ─────────────────────────────────

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

        scenario(G, "Super Admin · POST /schools", async (L) => {
            const res = await academicApi.createSchool(payload);
            const w = lastWire();
            schoolId = pick(res, "schoolId", "school_id", "id");
            created.schools.push(schoolId);
            expect(w.status).toBe(201);
            expect(w.request).toEqual(payload);
            expect(res).toMatchObject({ code: payload.code, name: payload.name, address: payload.address, phone: payload.phone, email: payload.email });
            expect(pick(res, "cityName", "city_name")).toBe(payload.cityName);
            L.layer = "bd";
            const row = one(`select * from academic.school where school_id = ${Number(schoolId)}`);
            expect(row).toMatchObject({
                code: payload.code, name: payload.name, address: payload.address, city_name: payload.cityName,
                phone: payload.phone, email: payload.email, status: true, deleted_at: null,
            });
            expect(Number(row.row_version)).toBeGreaterThanOrEqual(1);
            L.note = "El cuerpo de la web sale idéntico; la fila tiene las mismas 7 columnas.";
        });

        scenario(G, "Super Admin · POST /schools con un código que ya existe", async (L) => {
            await rejected(academicApi.createSchool({ name: `CT Otra ${rid}`, code: payload.code }), [400, 409, 422]);
            L.layer = "bd";
            expect(one(`select count(*)::int as n from academic.school where code = ${lit(payload.code)} and deleted_at is null`).n).toBe(1);
            L.note = "El endpoint rechaza el duplicado y la BD sigue con una sola fila con ese código.";
        });

        scenario(G, "Super Admin · PUT /schools/:id", async (L) => {
            const patch = { name: `CT Sede ${rid} editada`, phone: "6043334444" };
            const updated = await academicApi.updateSchool(schoolId, patch);
            expect(lastWire().status).toBe(200);
            expect(lastWire().request).toEqual(patch);
            expect(updated).toMatchObject(patch);
            L.layer = "bd";
            const row = one(`select * from academic.school where school_id = ${Number(schoolId)}`);
            expect(row).toMatchObject({ ...patch, code: payload.code, address: payload.address, email: payload.email });
            L.note = "Solo cambia lo enviado; code, address y email quedan intactos en la respuesta y en la BD.";
        });

        scenario(G, "Super Admin · PATCH /schools/:id/status", async (L) => {
            await academicApi.updateSchoolStatus(schoolId, false);
            expect(lastWire().request).toEqual({ status: false });
            expect(lastWire().status).toBe(200);
            L.layer = "bd";
            expect(one(`select status from academic.school where school_id = ${Number(schoolId)}`).status).toBe(false);
            L.note = "El cuerpo { status: false } llega tal cual y la BD queda con status = false.";
        });

        scenario(G, "Super Admin · DELETE /schools/:id", async (L) => {
            await academicApi.deleteSchool(schoolId);
            expect(lastWire().status).toBe(204);
            L.layer = "bd";
            const row = one(`select deleted_at from academic.school where school_id = ${Number(schoolId)}`);
            expect(row).not.toBeNull();
            expect(row.deleted_at).not.toBeNull();
            L.note = "Borrado lógico: la fila sigue con deleted_at. Antes de la corrección de la rama la web recibía 400 (C-02).";
        });
    });

    // ── Administrador de sede ───────────────────────────────

    describe("Administrador de sede solo maneja su propia sede", () => {
        let own;
        let ownId;
        let other;
        let programId;
        let periodId;
        let cohortId;
        let envId;
        let courseId;
        let enrollmentId;
        let blockId;

        beforeAll(async () => {
            await loginAs(siteAdmin);
            const list = await academicApi.listSchools();
            const found = Array.isArray(list) ? list : list?.content ?? [];
            expect(found).toHaveLength(1);
            own = found[0];
            ownId = Number(pick(own, "schoolId", "school_id"));
            other = one(`select school_id, code, name from academic.school where deleted_at is null and school_id <> ${ownId} limit 1`);
        });

        scenario(G, "Admin de sede · GET /schools", async (L) => {
            expect(lastWire().status).toBe(200);
            L.layer = "bd";
            const row = one(`select * from academic.school where school_id = ${ownId}`);
            expect(own).toMatchObject({ code: row.code, name: row.name });
            L.note = "Recibe una sola sede, la misma que tiene en la BD; nunca la lista completa.";
        });

        scenario(G, "Admin de sede · POST /schools", async (L) => {
            const code = `CTX${rid}`;
            await rejected(academicApi.createSchool({ name: `CT intruso ${rid}`, code }), [403]);
            expect(lastWire().request).toEqual({ name: `CT intruso ${rid}`, code });
            L.layer = "bd";
            expect(one(`select 1 as n from academic.school where code = ${lit(code)}`)).toBeNull();
            L.note = "403 y no queda ninguna fila nueva en academic.school.";
        });

        scenario(G, "Admin de sede · PUT de su sede", async (L) => {
            const before = one(`select * from academic.school where school_id = ${ownId}`);
            const patch = { name: before.name, phone: "6045556666" };
            const updated = await academicApi.updateSchool(ownId, patch);
            expect(lastWire().request).toEqual(patch);
            expect(updated.phone).toBe(patch.phone);
            L.layer = "bd";
            const after = one(`select * from academic.school where school_id = ${ownId}`);
            expect(after.phone).toBe(patch.phone);
            expect(after.code).toBe(before.code);
            expect(after.status).toBe(before.status);
            await academicApi.updateSchool(ownId, { phone: before.phone ?? undefined });
            L.note = "Cambia nombre y contacto; el code y el status de la fila no se mueven.";
        });

        [
            ["code", { code: `CTC${rid}` }],
            ["status", { status: false }],
            ["cityId", { cityId: 99 }],
        ].forEach(([field, patch]) => {
            scenario(G, `Admin de sede · PUT de su sede cambiando ${field}`, async (L) => {
                const before = one(`select * from academic.school where school_id = ${ownId}`);
                await rejected(academicApi.updateSchool(ownId, patch), [403]);
                expect(lastWire().request).toEqual(patch);
                L.layer = "bd";
                expect(one(`select * from academic.school where school_id = ${ownId}`)).toEqual(before);
                L.note = "403 y la fila queda idéntica a como estaba.";
            });
        });

        scenario(G, "Admin de sede · PUT, PATCH y DELETE de otra sede", async (L) => {
            if (!other) { L.note = "No hay una segunda sede para comparar."; return; }
            const before = one(`select * from academic.school where school_id = ${Number(other.school_id)}`);
            await rejected(academicApi.updateSchool(other.school_id, { name: "x" }), [404]);
            await rejected(academicApi.updateSchoolStatus(other.school_id, false), [403]);
            await rejected(academicApi.deleteSchool(other.school_id), [403]);
            L.layer = "bd";
            expect(one(`select * from academic.school where school_id = ${Number(other.school_id)}`)).toEqual(before);
            L.note = "404, 403 y 403; la fila de la otra sede no cambia.";
        });

        scenario(G, "Admin de sede · POST /programs", async (L) => {
            const body = { schoolId: ownId, code: `CTP${rid}`, name: `CT Programa ${rid}` };
            const res = await courseCreation.createProgram(body);
            programId = res.programId;
            created.programs.push(programId);
            expect(lastWire().status).toBe(201);
            expect(lastWire().request).toEqual({ ...body, status: true });
            L.layer = "bd";
            expect(one(`select * from academic.program where program_id = ${Number(programId)}`)).toMatchObject({
                school_id: ownId, code: body.code, name: body.name, status: true, deleted_at: null,
            });
            L.note = "Cuerpo { schoolId, code, name, status } = 201 = fila de academic.program.";
        });

        scenario(G, "Admin de sede · POST /programs con un código que ya existe", async (L) => {
            await rejected(courseCreation.createProgram({ schoolId: ownId, code: `CTP${rid}`, name: "CT otro" }), [400, 409, 422]);
            L.layer = "bd";
            expect(one(`select count(*)::int as n from academic.program where school_id = ${ownId} and code = ${lit(`CTP${rid}`)} and deleted_at is null`).n).toBe(1);
            L.note = "El endpoint rechaza el duplicado y la BD sigue con una sola fila (uq_program_code_school).";
        });

        scenario(G, "Admin de sede · POST /courses", async (L) => {
            const res = await courseCreation.createCourse({ programId, code: `CTC${rid}`, name: `CT Curso ${rid}`, creditHours: 4 });
            courseId = pick(res, "courseId", "course_id", "id");
            created.courses.push(courseId);
            expect(lastWire().status).toBe(201);
            expect(lastWire().request).toEqual({ programId, code: `CTC${rid}`, name: `CT Curso ${rid}`, status: true, creditHours: 4 });
            expect(pick(res, "creditHours", "credit_hours")).toBe(4);
            L.layer = "bd";
            expect(one(`select * from academic.course where course_id = ${Number(courseId)}`)).toMatchObject({
                program_id: programId, code: `CTC${rid}`, name: `CT Curso ${rid}`, credit_hours: 4, status: true, deleted_at: null,
            });
            L.note = "Cuerpo con creditHours = 201 = fila con credit_hours; el programa queda enlazado.";
        });

        scenario(G, "Admin de sede · PUT /courses/:id", async (L) => {
            await courseCreation.updateCourse(courseId, { programId, code: `CTC${rid}`, name: `CT Curso ${rid} v2`, creditHours: 6 });
            expect(lastWire().status).toBe(200);
            expect(lastWire().request).toEqual({ programId, code: `CTC${rid}`, name: `CT Curso ${rid} v2`, creditHours: 6 });
            L.layer = "bd";
            expect(one(`select * from academic.course where course_id = ${Number(courseId)}`)).toMatchObject({
                name: `CT Curso ${rid} v2`, credit_hours: 6, program_id: programId, deleted_at: null,
            });
            L.note = "La edición de la web cambia nombre y créditos en la fila sin tocar el resto.";
        });

        scenario(G, "Admin de sede · POST /academic-periods", async (L) => {
            const body = { schoolId: ownId, name: `CT Periodo ${rid}`, startsOn: "2031-01-01", endsOn: "2031-06-30", isActive: false };
            const res = await fichaCreation.createPeriod(body);
            periodId = res.academicPeriodId;
            created.periods.push(periodId);
            expect(lastWire().status).toBe(201);
            expect(lastWire().request).toEqual(body);
            L.layer = "bd";
            const row = one(`select academic_period_id, school_id, name, starts_on::text as starts_on, ends_on::text as ends_on, is_active, deleted_at from academic.academic_period where academic_period_id = ${Number(periodId)}`);
            expect(row).toMatchObject({ school_id: ownId, name: body.name, starts_on: body.startsOn, ends_on: body.endsOn, is_active: false, deleted_at: null });
            L.note = "Las fechas viajan como texto y quedan como date en la BD, sin desfase de zona.";
        });

        scenario(G, "Admin de sede · POST /cohorts (ficha)", async (L) => {
            const res = await fichaCreation.createCohort({ programId, academicPeriodId: periodId, code: `CTF${rid}` });
            cohortId = res.cohortId;
            created.cohorts.push(cohortId);
            expect(lastWire().status).toBe(201);
            expect(lastWire().request).toEqual({ programId, academicPeriodId: periodId, code: `CTF${rid}`, status: true });
            L.layer = "bd";
            expect(one(`select * from academic.cohort where cohort_id = ${Number(cohortId)}`)).toMatchObject({
                program_id: programId, academic_period_id: periodId, code: `CTF${rid}`, status: true, deleted_at: null,
            });
            L.note = "La ficha queda enlazada al programa y al período que mandó la web.";
        });

        scenario(G, "Admin de sede · POST /environments", async (L) => {
            const env = await environmentManagement.createEnvironment({ schoolId: ownId, code: `CTE${rid}`, name: `CT Ambiente ${rid}`, capacity: 25 });
            envId = env.id;
            created.envs.push(envId);
            expect(lastWire().status).toBe(201);
            expect(lastWire().request).toEqual({ schoolId: ownId, code: `CTE${rid}`, name: `CT Ambiente ${rid}`, capacity: 25, status: true });
            expect(env).toMatchObject({ number: `CTE${rid}`, description: `CT Ambiente ${rid}`, capacity: 25 });
            L.layer = "bd";
            expect(one(`select * from scheduling.environment where environment_id = ${Number(envId)}`)).toMatchObject({
                school_id: ownId, code: `CTE${rid}`, name: `CT Ambiente ${rid}`, capacity: 25, status: true, deleted_at: null,
            });
            L.note = "Cuerpo { schoolId, code, name, capacity, status } = 201 = fila de scheduling.environment.";
        });

        scenario(G, "Admin de sede · POST /environments con un código que ya existe", async (L) => {
            await rejected(environmentManagement.createEnvironment({ schoolId: ownId, code: `CTE${rid}`, name: "CT otro", capacity: 10 }), [400, 409, 422]);
            L.layer = "bd";
            expect(one(`select count(*)::int as n from scheduling.environment where school_id = ${ownId} and code = ${lit(`CTE${rid}`)} and deleted_at is null`).n).toBe(1);
            L.note = "El endpoint rechaza el duplicado y la BD sigue con una sola fila (uq_environment_code_school).";
        });

        scenario(G, "Admin de sede · POST /enrollments (matrícula)", async (L) => {
            const actor = one(`select a.academic_actor_id from academic.academic_actor a join academic.academic_actor_type t on t.actor_type_id = a.actor_type_id where a.school_id = ${ownId} and a.deleted_at is null and t.code = 'STUDENT' limit 1`);
            expect(actor).not.toBeNull();
            const res = await academicApi.createEnrollment({ academicActorId: actor.academic_actor_id, cohortId });
            enrollmentId = pick(res, "enrollmentId", "enrollment_id", "id");
            created.enrollments.push(enrollmentId);
            expect(lastWire().status).toBe(201);
            expect(lastWire().request).toEqual({ academicActorId: actor.academic_actor_id, cohortId });
            expect(pick(res, "enrollmentStatus", "enrollment_status")).toBe("Active");
            L.layer = "bd";
            const row = one(`select * from academic.enrollment where enrollment_id = ${Number(enrollmentId)}`);
            expect(row).toMatchObject({ academic_actor_id: actor.academic_actor_id, cohort_id: cohortId, enrollment_status: "Active", deleted_at: null });
            expect(row.enrolled_on).toBeTruthy();
            L.note = "La matrícula nace Active con enrolled_on lleno, aunque la web no manda la fecha.";
        });

        scenario(G, "Admin de sede · PATCH /enrollments/:id/status", async (L) => {
            await academicApi.updateEnrollmentStatus(enrollmentId, "Withdrawn");
            expect(lastWire().request).toEqual({ enrollmentStatus: "Withdrawn" });
            expect(lastWire().status).toBe(200);
            L.layer = "bd";
            expect(one(`select enrollment_status from academic.enrollment where enrollment_id = ${Number(enrollmentId)}`).enrollment_status).toBe("Withdrawn");
            L.note = "El estado viaja como { enrollmentStatus } y la columna enum cambia a Withdrawn.";
        });

        scenario(G, "Admin de sede · DELETE /enrollments/:id", async (L) => {
            await academicApi.deleteEnrollment(enrollmentId);
            expect(lastWire().status).toBe(204);
            L.layer = "bd";
            const row = one(`select deleted_at from academic.enrollment where enrollment_id = ${Number(enrollmentId)}`);
            expect(row).not.toBeNull();
            expect(row.deleted_at).not.toBeNull();
            L.note = "Borrado lógico: la fila sigue con deleted_at.";
        });

        scenario(G, "Admin de sede · matricular a alguien de otra sede", async (L) => {
            const stranger = one(`select a.academic_actor_id from academic.academic_actor a where a.school_id <> ${ownId} and a.deleted_at is null limit 1`);
            if (!stranger) { L.note = "No hay actores de otra sede para comparar."; return; }
            const before = one(`select count(*)::int as n from academic.enrollment where academic_actor_id = ${Number(stranger.academic_actor_id)} and cohort_id = ${Number(cohortId)}`);
            await rejected(academicApi.createEnrollment({ academicActorId: stranger.academic_actor_id, cohortId }), [403]);
            L.layer = "bd";
            expect(one(`select count(*)::int as n from academic.enrollment where academic_actor_id = ${Number(stranger.academic_actor_id)} and cohort_id = ${Number(cohortId)}`)).toEqual(before);
            L.note = "403 y no queda ninguna matrícula nueva con el actor de otra sede.";
        });

        scenario(G, "Auditoría de lo creado (programa, curso, período, ficha y ambiente)", async (L) => {
            const checks = [
                ["academic.program", "program_id", programId], ["academic.course", "course_id", courseId],
                ["academic.academic_period", "academic_period_id", periodId], ["academic.cohort", "cohort_id", cohortId],
                ["scheduling.environment", "environment_id", envId],
            ];
            L.layer = "bd";
            for (const [table, col, id] of checks) {
                const row = one(`select created_at, updated_at, row_version from ${table} where ${col} = ${Number(id)}`);
                expect(row.created_at).toBeTruthy();
                expect(row.updated_at).toBeTruthy();
                expect(Number(row.row_version)).toBeGreaterThanOrEqual(1);
            }
            L.note = "created_at, updated_at y row_version llenos en las cinco filas.";
        });

scenario(G, "Admin de sede · POST /schedule-blocks", async (L) => {
            const instructor = one(`select a.academic_actor_id from academic.academic_actor a join academic.academic_actor_type t on t.actor_type_id = a.actor_type_id where a.school_id = ${ownId} and a.deleted_at is null and t.code = 'INSTRUCTOR' limit 1`);
            expect(instructor).not.toBeNull();
            const scheduleBlocks = require("../scheduleBlockManagement");
            const [res] = await scheduleBlocks.createBlocks({
                environmentId: envId, courseId, cohortId, instructorActorId: instructor.academic_actor_id,
                daysOfWeek: [3], startsAt: "07:00:00", endsAt: "09:00:00",
            });
            blockId = pick(res, "scheduleBlockId", "schedule_block_id", "id");
            created.blocks.push(blockId);
            expect(lastWire().status).toBe(201);
            expect(lastWire().request).toEqual({
                environmentId: Number(envId), courseId, cohortId, instructorActorId: instructor.academic_actor_id,
                dayOfWeek: 3, startsAt: "07:00:00", endsAt: "09:00:00",
            });
            L.layer = "bd";
            const row = one(`select schedule_block_id, environment_id, course_id, cohort_id, instructor_actor_id, day_of_week, starts_at::text as starts_at, ends_at::text as ends_at, deleted_at from scheduling.schedule_block where schedule_block_id = ${Number(blockId)}`);
            expect(row).toMatchObject({
                environment_id: Number(envId), course_id: courseId, cohort_id: cohortId, instructor_actor_id: instructor.academic_actor_id,
                day_of_week: 3, starts_at: "07:00:00", ends_at: "09:00:00", deleted_at: null,
            });
            L.note = "La web manda día ISO y horas con segundos; la fila guarda los mismos valores.";
        });

        scenario(G, "Admin de sede · POST /schedule-blocks que se solapa con otro", async (L) => {
            const scheduleBlocks = require("../scheduleBlockManagement");
            const before = one(`select count(*)::int as n from scheduling.schedule_block where environment_id = ${envId} and deleted_at is null`).n;
            await rejected(scheduleBlocks.createBlocks({
                environmentId: envId, courseId, cohortId, instructorActorId: one(`select instructor_actor_id from scheduling.schedule_block where schedule_block_id = ${Number(blockId)}`).instructor_actor_id,
                daysOfWeek: [3], startsAt: "08:00:00", endsAt: "10:00:00",
            }), [400, 409, 422]);
            L.layer = "bd";
            expect(one(`select count(*)::int as n from scheduling.schedule_block where environment_id = ${envId} and deleted_at is null`).n).toBe(before);
            L.note = "El endpoint rechaza el solape de ambiente e instructor y no queda ninguna fila nueva.";
        });

        scenario(G, "Admin de sede · DELETE de un ambiente con bloques vivos", async (L) => {
            await rejected(environmentManagement.deleteEnvironment(envId), [409]);
            L.layer = "bd";
            expect(one(`select deleted_at from scheduling.environment where environment_id = ${Number(envId)}`).deleted_at).toBeNull();
            L.note = "El endpoint debe negarse (409) mientras haya bloques vivos; si acepta, los bloques quedan huérfanos y la lista de bloques del Admin de sede responde 404.";
        });

        scenario(G, "Admin de sede · DELETE /schedule-blocks/:id", async (L) => {
            const scheduleBlocks = require("../scheduleBlockManagement");
            await scheduleBlocks.deleteBlock(blockId);
            expect(lastWire().status).toBe(204);
            L.layer = "bd";
            const row = one(`select deleted_at from scheduling.schedule_block where schedule_block_id = ${Number(blockId)}`);
            expect(row).not.toBeNull();
            expect(row.deleted_at).not.toBeNull();
            L.note = "Borrado lógico: la fila sigue con deleted_at (en develop se borraba físicamente: C-03).";
        });

        scenario(G, "Admin de sede · DELETE /environments/:id", async (L) => {
            await environmentManagement.deleteEnvironment(envId);
            expect(lastWire().status).toBe(204);
            L.layer = "bd";
            const row = one(`select deleted_at from scheduling.environment where environment_id = ${Number(envId)}`);
            expect(row).not.toBeNull(); // antes de la corrección el servicio la borraba físicamente
            expect(row.deleted_at).not.toBeNull();
            L.note = "Borrado lógico (en develop se borraba físicamente: C-03).";
        });
    });
});
