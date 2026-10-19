// ============================================================
//  FaceAttend EDU — Bloques de horario en el backend
//
//  POST/PUT/DELETE /api/v1/schedule-blocks (ms-scheduling).
//  Un formulario con N días crea N bloques (uno por día ISO 1..7).
//  Las filas locales (`sch_…`) nunca tocan la red.
// ============================================================

import { schedulingApi } from "./schedulingApi";
import { listActors, listCohorts, listCourses } from "./referenceData";

export const LOCAL_SCHEDULE_PREFIX = "sch_";

// Etiquetas en orden ISO (Lun=1 … Dom=7), en espejo de WEEK_DAYS.
export const ISO_DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function num(value) {
    if (value == null || String(value).trim() === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** ID numérico del backend o null si la fila es local. */
export function backendScheduleId(id) {
    if (typeof id === "string" && id.startsWith(LOCAL_SCHEDULE_PREFIX)) return null;
    return num(id);
}

export function dayLabelToIso(label) {
    const index = ISO_DAY_LABELS.indexOf(label);
    return index === -1 ? null : index + 1;
}

export function isoToDayLabel(dayOfWeek) {
    return ISO_DAY_LABELS[Number(dayOfWeek) - 1] ?? null;
}

function courseIdOf(course) {
    return course?.courseId ?? course?.course_id ?? null;
}

function programIdOf(record) {
    return record?.programId ?? record?.program_id ?? null;
}

function cohortIdOf(cohort) {
    return cohort?.cohortId ?? cohort?.cohort_id ?? null;
}

function actorIdOf(actor) {
    return actor?.academicActorId ?? actor?.academic_actor_id ?? null;
}

/**
 * Cohortes vigentes del programa del curso (para el selector de ficha).
 * Vacío si el curso no existe en el backend o no tiene programa.
 */
export async function cohortsForCourse(courseCode) {
    const courses = await listCourses();
    const course = (Array.isArray(courses) ? courses : []).find((c) => c?.code === courseCode);
    const programId = programIdOf(course);
    if (programId == null) return [];
    const cohorts = await listCohorts();
    return (Array.isArray(cohorts) ? cohorts : [])
        .filter((c) => programIdOf(c) === programId && c?.status !== false)
        .map((c) => ({ cohortId: cohortIdOf(c), code: c?.code ?? "" }))
        .filter((c) => c.cohortId != null);
}

/**
 * academic_actor_id del instructor a partir del userId del formulario.
 * Null si la cuenta no tiene actor docente en la sede.
 */
export async function instructorActorForUser(users, userId) {
    const user = (users ?? []).find((u) => String(u?.id) === String(userId));
    const personId = user?.personId ?? null;
    if (personId == null) return null;
    const actors = await listActors();
    const match = (Array.isArray(actors) ? actors : []).find(
        (a) =>
            String(a?.personId ?? a?.person_id ?? "") === String(personId) &&
            ((a?.actorTypeId ?? a?.actor_type_id) === 2 ||
                String(a?.actorType ?? a?.actor_type ?? "").toUpperCase() === "INSTRUCTOR")
    );
    return match ? actorIdOf(match) : null;
}

function blockIdOf(response) {
    return response?.scheduleBlockId ?? response?.schedule_block_id ?? response?.id ?? null;
}

function checkedBlockPayload({ environmentId, courseId, cohortId, instructorActorId, dayOfWeek, startsAt, endsAt }) {
    const payload = {
        environmentId: num(environmentId),
        courseId: num(courseId),
        cohortId: num(cohortId),
        instructorActorId: num(instructorActorId),
        dayOfWeek: num(dayOfWeek),
        startsAt,
        endsAt,
    };
    const missing = Object.entries(payload)
        .filter(([, v]) => v == null || v === "")
        .map(([k]) => k);
    if (missing.length > 0) {
        throw new Error(`Missing block fields: ${missing.join(", ")}`);
    }
    if (payload.dayOfWeek < 1 || payload.dayOfWeek > 7) {
        throw new Error("dayOfWeek must be 1..7");
    }
    return payload;
}

/**
 * Crea un bloque por día y devuelve las respuestas del backend.
 */
export async function createBlocks({ environmentId, courseId, cohortId, instructorActorId, daysOfWeek, startsAt, endsAt }) {
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
        throw new Error("Select at least one day");
    }
    const created = [];
    for (const day of daysOfWeek) {
        const payload = checkedBlockPayload({
            environmentId,
            courseId,
            cohortId,
            instructorActorId,
            dayOfWeek: day,
            startsAt,
            endsAt,
        });
        created.push(await schedulingApi.createBlock(payload));
    }
    return created;
}

export function createdBlockId(response) {
    const id = blockIdOf(response);
    if (id == null) throw new Error("Block creation returned no id");
    return String(id);
}

/**
 * Reemplazo de un bloque: crea los nuevos primero y borra el anterior.
 */
export async function replaceBlock(oldId, payload) {
    const created = await createBlocks(payload);
    await schedulingApi.deleteBlock(oldId);
    return created;
}

/**
 * Borra el bloque en el backend (solo IDs numéricos).
 */
export async function deleteBlock(id) {
    const backendId = backendScheduleId(id);
    if (backendId == null) throw new Error("Schedule is not synced with the backend yet");
    await schedulingApi.deleteBlock(backendId);
}
