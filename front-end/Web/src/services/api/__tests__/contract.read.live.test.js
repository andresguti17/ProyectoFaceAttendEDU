/**
 * Contrato web ⇄ endpoint ⇄ BD, LECTURAS, contra el stack local (docker compose).
 *
 * Para cada colección que la web pinta, se baja la lista completa como lo hace la web
 * (fetchAllPages, con su paginación) y se compara con PostgreSQL:
 *   web ⇄ endpoint   la lista que arma la web no repite ids ni se queda corta frente al total
 *                    que declara el endpoint
 *   endpoint ⇄ BD    mismo conjunto de ids que las filas vivas (deleted_at IS NULL) y los mismos
 *                    valores de las columnas que muestra la pantalla
 * Con el Super Administrador se espera toda la tabla; con el Admin de sede, solo las filas de
 * su sede (si el endpoint trae filas de otra sede, el escenario falla: es una fuga entre sedes).
 *
 *   node verificar-contrato.mjs
 */
import { LIVE, bootWeb, flushReport, loginAs, readCredentials, scenario, sql, one, pick } from "../testing/contractHarness";

const run = LIVE ? describe : describe.skip;

// Cada colección: ruta de la web, clave del id y columnas que se comparan (clave de la API → columna de la BD).
// `scope` es el WHERE que deja solo las filas de la sede :school.
const COLLECTIONS = [
    { name: "Escuelas", path: (e) => e.academic.schools, id: "schoolId", table: "academic.school", col: "school_id",
        fields: { code: "code", name: "name", cityName: "city_name", address: "address", phone: "phone", email: "email", status: "status" },
        scope: (s) => `school_id = ${s}` },
    { name: "Programas", path: (e) => e.academic.programs, id: "programId", table: "academic.program", col: "program_id",
        fields: { schoolId: "school_id", code: "code", name: "name", status: "status" },
        scope: (s) => `school_id = ${s}` },
    { name: "Períodos académicos", path: (e) => e.academic.periods, id: "academicPeriodId", table: "academic.academic_period", col: "academic_period_id",
        fields: { schoolId: "school_id", name: "name", startsOn: "starts_on", endsOn: "ends_on", isActive: "is_active" },
        scope: (s) => `school_id = ${s}`, text: ["starts_on", "ends_on"] },
    { name: "Fichas (cohortes)", path: (e) => e.academic.cohorts, id: "cohortId", table: "academic.cohort", col: "cohort_id",
        fields: { programId: "program_id", academicPeriodId: "academic_period_id", code: "code", status: "status" },
        scope: (s) => `program_id in (select program_id from academic.program where school_id = ${s})` },
    { name: "Cursos", path: (e) => e.academic.courses, id: "courseId", table: "academic.course", col: "course_id",
        fields: { programId: "program_id", code: "code", name: "name", creditHours: "credit_hours", status: "status" },
        scope: (s) => `program_id in (select program_id from academic.program where school_id = ${s})` },
    { name: "Actores académicos", path: (e) => e.academic.actors, id: "academicActorId", table: "academic.academic_actor", col: "academic_actor_id",
        fields: { personId: "person_id", actorTypeId: "actor_type_id", schoolId: "school_id", actorCode: "actor_code", status: "status" },
        scope: (s) => `school_id = ${s}` },
    { name: "Matrículas", path: (e) => e.academic.enrollments, id: "enrollmentId", table: "academic.enrollment", col: "enrollment_id",
        fields: { academicActorId: "academic_actor_id", cohortId: "cohort_id", enrollmentStatus: "enrollment_status" },
        scope: (s) => `academic_actor_id in (select academic_actor_id from academic.academic_actor where school_id = ${s})` },
    { name: "Ambientes", path: (e) => e.scheduling.environments, id: "environmentId", table: "scheduling.environment", col: "environment_id",
        fields: { schoolId: "school_id", code: "code", name: "name", capacity: "capacity", status: "status" },
        scope: (s) => `school_id = ${s}` },
    { name: "Bloques horarios", path: (e) => e.scheduling.blocks, id: "scheduleBlockId", table: "scheduling.schedule_block", col: "schedule_block_id",
        fields: { cohortId: "cohort_id", courseId: "course_id", environmentId: "environment_id", instructorActorId: "instructor_actor_id", dayOfWeek: "day_of_week" },
        scope: (s) => `environment_id in (select environment_id from scheduling.environment where school_id = ${s})` },
];

const norm = (v) => (v === null || v === undefined || v === "" ? null : typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 10) : v);

async function webList(c) {
    const { fetchAllPages } = require("../../../api/apiClient");
    const { endpoints } = require("../../../api/endpoints");
    return fetchAllPages(c.path(endpoints));
}

function compare(c, items, where) {
    const textCols = c.text ?? [];
    const select = Object.values(c.fields).map((col) => (textCols.includes(col) ? `${col}::text as ${col}` : col)).join(", ");
    const db = sql(`select ${c.col}, ${select} from ${c.table} where deleted_at is null${where ? ` and ${where}` : ""}`);
    const dbById = new Map(db.map((r) => [String(r[c.col]), r]));
    const apiById = new Map(items.map((i) => [String(i[c.id]), i]));

    const missing = [...dbById.keys()].filter((id) => !apiById.has(id));
    const extra = [...apiById.keys()].filter((id) => !dbById.has(id));
    const diffs = [];
    for (const [id, api] of apiById) {
        const row = dbById.get(id);
        if (!row) continue;
        for (const [key, col] of Object.entries(c.fields)) {
            if (norm(api[key]) !== norm(row[col])) {
                if (diffs.length < 5) diffs.push(`${c.id} ${id}: ${key} API=${JSON.stringify(api[key])} BD=${JSON.stringify(row[col])}`);
            }
        }
    }
    return { db: db.length, missing, extra, diffs };
}

run("contrato web ⇄ endpoint ⇄ BD: lecturas", () => {
    let restoreFetch;
    const superAdmin = readCredentials(".cuentas.local", "admin.faceattend");
    const siteAdmin = readCredentials(".cuentas.qa", "ADM");

    beforeAll(() => { restoreFetch = bootWeb(); });
    afterAll(() => { flushReport("read"); restoreFetch?.(); });

    describe("Super Administrador: cada lista es toda la tabla", () => {
        beforeAll(async () => { await loginAs(superAdmin); });

        COLLECTIONS.forEach((c) => {
            scenario("Lecturas (Super Admin)", `Super Admin · lista de ${c.name}`, async (L) => {
                const items = await webList(c);
                const ids = items.map((i) => String(i[c.id]));
                expect(new Set(ids).size).toBe(ids.length); // la web no repite filas
                L.layer = "bd";
                const r = compare(c, items, "");
                L.note = `${items.length} filas por la API y ${r.db} vivas en la BD.`;
                expect({ faltan: r.missing.slice(0, 5), sobran: r.extra.slice(0, 5), valores: r.diffs }).toEqual({ faltan: [], sobran: [], valores: [] });
            });
        });
    });

    describe("Admin de sede: cada lista llega acotada a su sede", () => {
        let schoolId;

        beforeAll(async () => {
            await loginAs(siteAdmin);
            const { academicApi } = require("../academicApi");
            const list = await academicApi.listSchools();
            schoolId = Number(pick((Array.isArray(list) ? list : list?.content ?? [])[0], "schoolId", "school_id"));
            expect(Number.isInteger(schoolId)).toBe(true);
        });

        COLLECTIONS.forEach((c) => {
            scenario("Lecturas (Admin de sede)", `Admin de sede · lista de ${c.name}`, async (L) => {
                const items = await webList(c);
                const ids = items.map((i) => String(i[c.id]));
                expect(new Set(ids).size).toBe(ids.length);
                L.layer = "bd";
                const r = compare(c, items, c.scope(schoolId));
                L.note = `${items.length} filas por la API y ${r.db} de su sede en la BD (de ${one(`select count(*)::int as n from ${c.table} where deleted_at is null`).n} en total).`;
                expect({ deOtrasSedes: r.extra.slice(0, 5), faltan: r.missing.slice(0, 5), valores: r.diffs }).toEqual({ deOtrasSedes: [], faltan: [], valores: [] });
            });
        });
    });
});
