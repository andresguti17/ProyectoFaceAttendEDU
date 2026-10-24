// ============================================================
//  FaceAttend EDU — referenceData
//
//  Datos de referencia compartidos por los módulos Storage
//  (environments, courses, fichas, students, users).
//
//  Cada colección se pide a la API UNA sola vez por sesión:
//  los loadX() que corre AppDataContext en paralelo comparten
//  la misma promesa, así que no se duplican peticiones.
//
//  Convenciones:
//  - Solo lectura; las escrituras siguen en cada *Storage.
//  - Todo se carga con fetchAllPages (sin truncar listas).
//  - Las cargas "secundarias" (roles, bloques...) deben usarse
//    con optional(): si fallan, el caller aplica sus defaults.
// ============================================================

import { fetchAllPages, request } from "../../api/apiClient";
import { endpoints } from "../../api/endpoints";

const cache = new Map();

function memo(key, load) {
    if (!cache.has(key)) {
        cache.set(
            key,
            load().catch((error) => {
                cache.delete(key); // un fallo no debe quedar cacheado
                throw error;
            })
        );
    }
    return cache.get(key);
}

/** Ejecuta una carga secundaria; si falla devuelve el valor por defecto. */
export async function optional(promise, fallback) {
    try {
        return await promise;
    } catch (error) {
        // El fallback evita romper la pantalla, pero el fallo queda registrado:
        // "sin datos" y "petición rechazada" no deben parecer lo mismo en consola.
        console.warn("[FaceAttend] optional(): carga secundaria fallida —", error?.message);
        return fallback;
    }
}

/** Olvida las cargas en memoria (llamar tras una escritura cuando se cable el CRUD). */
export function resetReferenceData() {
    cache.clear();
}

// ── Sede activa ───────────────────────────────────────────
// La sede del usuario (de su academic_actor) acota TODA la carga. Sin esto un
// administrador de una institución veía los datos de las dos mezclados. Si es
// null —un super admin sin actor— se cargan todas las sedes, como antes.

let activeSchoolId = null;

export function setActiveSchool(schoolId) {
    const next = schoolId ?? null;
    if (next === activeSchoolId) return;
    activeSchoolId = next;
    cache.clear(); // los datos cacheados son de la sede anterior
}

export const getActiveSchool = () => activeSchoolId;

/**
 * GET /users exige identity.person:write; sin ese permiso el backend responde
 * 403. La regla se aplica aquí —no en cada caller— para que ningún Storage
 * dispare la petición con un rol que no puede verla (Instructor/Aprendiz):
 * listUsers() devuelve vacío sin salir a la red.
 */
let usersListAllowed = false;

export function setUsersListAllowed(allowed) {
    const next = Boolean(allowed);
    if (next === usersListAllowed) return;
    usersListAllowed = next;
    // El permiso cambió: la lista y el mapa derivado ya no son válidos.
    cache.delete("users");
    cache.delete("userByPersonMap");
}

/** Ids de los programas de la sede activa; vacío cuando no hay sede. */
const schoolProgramIds = () =>
    memo("schoolProgramIds", async () =>
        (await listPrograms()).map((p) => p.programId).filter((v) => v != null)
    );

/** Une el resultado de un endpoint anidado sobre varios padres. */
async function unionOf(parentIds, pathFor) {
    const pages = await Promise.all(parentIds.map((id) => fetchAllPages(pathFor(id))));
    return pages.flat();
}

// ── Colecciones ───────────────────────────────────────────

export const listPersons = () =>
    memo("persons", () => fetchAllPages(endpoints.identity.persons, {}, { by: "page" }));

export const listUsers = () =>
    memo("users", () =>
        usersListAllowed
            ? fetchAllPages(endpoints.identity.users, {}, { by: "page" })
            : Promise.resolve([])
    );

export const listActors = () =>
    memo("actors", () =>
        activeSchoolId == null
            ? fetchAllPages(endpoints.academic.actors)
            : fetchAllPages(endpoints.academic.schoolActors(activeSchoolId))
    );

export const listActorTypes = () =>
    memo("actorTypes", () => fetchAllPages(endpoints.academic.actorTypes));

export const listCourses = () =>
    memo("courses", async () =>
        activeSchoolId == null
            ? fetchAllPages(endpoints.academic.courses)
            : unionOf(await schoolProgramIds(), endpoints.academic.programCourses)
    );

export const listCohorts = () =>
    memo("cohorts", async () =>
        activeSchoolId == null
            ? fetchAllPages(endpoints.academic.cohorts)
            : unionOf(await schoolProgramIds(), endpoints.academic.programCohorts)
    );

export const listPrograms = () =>
    memo("programs", () =>
        activeSchoolId == null
            ? fetchAllPages(endpoints.academic.programs)
            : fetchAllPages(endpoints.academic.schoolPrograms(activeSchoolId))
    );

export const listEnrollments = () =>
    memo("enrollments", async () => {
        if (activeSchoolId == null) return fetchAllPages(endpoints.academic.enrollments);
        const cohortIds = (await listCohorts()).map((c) => c.cohortId).filter((v) => v != null);
        return unionOf(cohortIds, endpoints.academic.cohortEnrollments);
    });

export const listBlocks = () =>
    memo("blocks", async () => {
        const blocks = await fetchAllPages(endpoints.scheduling.blocks);
        if (activeSchoolId == null) return blocks;
        // schedule_block no tiene ruta por sede (su school_id es indirecto, vía
        // cohorte), así que se acota con los cohortes de la sede ya cargados.
        const cohortIds = new Set((await listCohorts()).map((c) => c.cohortId));
        return blocks.filter((b) => cohortIds.has(b.cohortId));
    });

export const listEnvironments = () =>
    memo("environments", () =>
        request(endpoints.scheduling.environments, {
            method: "GET",
            query: activeSchoolId == null ? undefined : { schoolId: activeSchoolId },
        })
    );

/** GET /users/{id}/roles (público, respuesta: arreglo de RoleResponse). */
export const rolesForUser = (userId) =>
    memo(`roles:${userId}`, () =>
        request(endpoints.authorization.userRoles(userId), { method: "GET" })
    );

/**
 * GET /user-roles?userIds=... — roles de varios usuarios en UNA petición.
 * Sustituye el bucle de una llamada por usuario: con 88 cuentas eran 88 viajes.
 * El endpoint acepta 300 ids por petición, así que la lista se parte en lotes de 200.
 * Devuelve Map<userId, RoleResponse[]>; un usuario sin roles no aparece en el mapa.
 */
export const rolesForUsers = (userIds) =>
    memo(`rolesBatch:${[...userIds].sort((a, b) => String(a).localeCompare(String(b))).join(",")}`, async () => {
        const BATCH = 200;
        const batches = [];
        for (let i = 0; i < userIds.length; i += BATCH) batches.push(userIds.slice(i, i + BATCH));

        const responses = await Promise.all(
            batches.map((batch) =>
                request(endpoints.authorization.userRolesBatch, {
                    method: "GET",
                    query: { userIds: batch.join(",") },
                })
            )
        );

        const byUser = new Map();
        for (const response of responses) {
            for (const [userId, roles] of Object.entries(response ?? {})) byUser.set(userId, roles);
        }
        return byUser;
    });

/**
 * GET /attendance-records/summary?academicActorIds=... — conteos por actor,
 * agregados en SQL. El endpoint acepta 300 ids, así que la lista se parte en
 * lotes de 200 que viajan en paralelo.
 * Devuelve Map<academicActorId, { present, late, absent, justified, total }>.
 */
export const attendanceSummaryFor = (actorIds) =>
    memo(`attendance:${[...actorIds].sort((a, b) => a - b).join(",")}`, async () => {
        const BATCH = 200;
        const batches = [];
        for (let i = 0; i < actorIds.length; i += BATCH) batches.push(actorIds.slice(i, i + BATCH));

        const responses = await Promise.all(
            batches.map((batch) =>
                request(endpoints.attendance.recordsSummary, {
                    method: "GET",
                    query: { academicActorIds: batch.join(",") },
                })
            )
        );

        const byActor = new Map();
        for (const response of responses) {
            for (const [actorId, counts] of Object.entries(response ?? {})) byActor.set(Number(actorId), counts);
        }
        return byActor;
    });

// ── Mapas de consulta (una sola construcción por sesión) ──

export const personMap = () =>
    memo("personMap", async () => new Map((await listPersons()).map((p) => [p.personId, p])));

export const actorMap = () =>
    memo("actorMap", async () => {
        const actors = await listActors();
        return new Map(actors.map((a) => [a.academicActorId, a]));
    });

export const userByPersonMap = () =>
    memo("userByPersonMap", async () => {
        const users = await listUsers();
        return new Map(users.map((u) => [u.personId, u]));
    });

export const courseMap = () =>
    memo("courseMap", async () => {
        const courses = await listCourses();
        return new Map(courses.map((c) => [c.courseId, c]));
    });

export const programMap = () =>
    memo("programMap", async () => {
        const programs = await listPrograms();
        return new Map(programs.map((p) => [p.programId, p]));
    });

export const cohortMap = () =>
    memo("cohortMap", async () => {
        const cohorts = await listCohorts();
        return new Map(cohorts.map((c) => [c.cohortId, c]));
    });

export const actorTypeMap = () =>
    memo("actorTypeMap", async () => {
        const types = await listActorTypes();
        return new Map(types.map((t) => [t.actorTypeId, t]));
    });

/**
 * personId -> nombres de curso que imparte, derivado de los bloques
 * horarios (block.instructorActorId -> actor -> persona).
 * Útil para mostrar el curso de un docente sin campo equivalente en el backend.
 */
export const instructorCourseNamesByPerson = () =>
    memo("instructorCourseNamesByPerson", async () => {
        const [blocks, actors, courses] = await Promise.all([
            listBlocks(),
            actorMap(),
            courseMap(),
        ]);
        const names = new Map();
        for (const block of blocks) {
            const actor = actors.get(block.instructorActorId);
            const course = courses.get(block.courseId);
            if (!actor?.personId || !course?.name) continue;
            const list = names.get(actor.personId) ?? [];
            if (!list.includes(course.name)) list.push(course.name);
            names.set(actor.personId, list);
        }
        return names;
    });

/**
 * personId -> academicActorId de los estudiantes matriculados en un cohorte.
 * Une enrollments (cohorte) con actores (persona); ignora matrículas de otros cohortes.
 */
export const cohortActorByPerson = (cohortId) =>
    memo(`cohortActorByPerson:${cohortId}`, async () => {
        const [enrollments, actors] = await Promise.all([listEnrollments(), actorMap()]);
        const map = new Map();
        for (const enrollment of enrollments) {
            if (enrollment.cohortId !== cohortId) continue;
            const actor = actors.get(enrollment.academicActorId);
            if (actor?.personId) map.set(actor.personId, enrollment.academicActorId);
        }
        return map;
    });

/**
 * Lista (ordenada por nombre) de los estudiantes matriculados en un cohorte,
 * para el panel de asistencia del kiosco: { academicActorId, personId, name }.
 * Reutiliza las mismas fuentes que cohortActorByPerson, sin duplicar la
 * lógica de filtrado por cohorte.
 */
export const cohortRoster = (cohortId) =>
    memo(`cohortRoster:${cohortId}`, async () => {
        const [enrollments, actors, persons] = await Promise.all([
            listEnrollments(),
            actorMap(),
            personMap(),
        ]);
        const roster = [];
        for (const enrollment of enrollments) {
            if (enrollment.cohortId !== cohortId) continue;
            const actor = actors.get(enrollment.academicActorId);
            if (!actor?.personId) continue;
            const person = persons.get(actor.personId);
            roster.push({
                academicActorId: enrollment.academicActorId,
                personId: actor.personId,
                name: fullName(person) || actor.personId,
            });
        }
        roster.sort((a, b) => a.name.localeCompare(b.name));
        return roster;
    });

// ── Utilidades de formato ─────────────────────────────────

/** Nombre completo de una persona del backend ("Nombre Apellido"). */
export function fullName(person) {
    if (!person) return "";
    return `${person.name ?? ""} ${person.lastName ?? ""}`.trim();
}

/** status booleano del backend → "active" | "inactive" (la UI espera strings). */
export function normalizeStatus(status) {
    if (typeof status === "boolean") return status ? "active" : "inactive";
    if (typeof status === "string" && status) return status.toLowerCase();
    return "active";
}

/** "08:00:00" (LocalTime) → "08:00". */
export function hhmm(time) {
    return typeof time === "string" ? time.slice(0, 5) : "";
}

// Días ISO 1..7 → etiquetas cortas usadas por la UI.
export const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function dayLabel(dayOfWeek) {
    return DAY_LABELS[(Number(dayOfWeek) || 1) - 1] ?? "";
}
