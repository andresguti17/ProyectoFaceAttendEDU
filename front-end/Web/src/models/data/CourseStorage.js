// ============================================================
//  FaceAttend EDU — CourseStorage
//
//  Lectura de cursos: API académica (GET /courses + /schedule-blocks
//  + /enrollments) con los mocks como respaldo si falla.
//
//  Derivados que el backend aún no expone y se calculan aquí:
//  - students: matrículas activas de los cohortes del curso
//  - professor: instructores de los bloques del curso
//  - schedule / room: días y ambiente desde los bloques
//  - avgAttendance: 0 hasta la fase de consulta de asistencia
//  - startDate / endDate: null (el calculador de períodos devuelve '—')
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_MODE } from "../../config/env";
import { mockCourses } from "./mockData";
import { colorAt } from "../../core/constants/dataColors";
import {
    actorMap,
    attendanceSummaryFor,
    dayLabel,
    fullName,
    listBlocks,
    listCohorts,
    listCourses,
    listEnrollments,
    listEnvironments,
    normalizeStatus,
    optional,
    personMap,
} from "../../services/api/referenceData";

const STORAGE_KEY = "@faceattend_courses_v2"; // v2 para forzar recarga limpia
const LOCAL_PREFIX = "course_";

function generateId() {
    return `course_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Lectura ───────────────────────────────────────────────

async function localCourses() {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (course) => typeof course?.id === "string" && course.id.startsWith(LOCAL_PREFIX)
        );
    } catch {
        return [];
    }
}

async function coursesFromApi() {
    const [courses, blocks] = await Promise.all([listCourses(), listBlocks()]);
    if (!Array.isArray(courses)) return [];

    const [enrollments, actors, persons, environments, cohorts] = await Promise.all([
        optional(listEnrollments(), []),
        optional(actorMap(), new Map()),
        optional(personMap(), new Map()),
        optional(listEnvironments(), []),
        optional(listCohorts(), []),
    ]);

    // Un curso reutiliza el mismo courseId en períodos distintos (bloques de
    // semestres pasados quedan igual enlazados), así que solo los cohortes
    // vigentes cuentan para "cantidad de estudiantes".
    const activeCohortIds = new Set(
        cohorts.filter((cohort) => cohort.status !== false).map((cohort) => cohort.cohortId)
    );

    // courseId -> Set(cohortId): los cohortes vigentes que imparten este curso
    const courseCohorts = new Map();
    for (const block of blocks) {
        if (!block.cohortId || !block.courseId) continue;
        if (!activeCohortIds.has(block.cohortId)) continue;
        const set = courseCohorts.get(block.courseId) ?? new Set();
        set.add(block.cohortId);
        courseCohorts.set(block.courseId, set);
    }

    // Matrículas activas por cohorte (el alto se cuenta por actor único);
    // "Completed"/"Withdrawn" ya no son estudiantes actuales del curso.
    const actorsByCohort = new Map();
    for (const enrollment of enrollments) {
        const status = String(enrollment.enrollmentStatus ?? "").toLowerCase();
        if (status !== "active") continue;
        const set = actorsByCohort.get(enrollment.cohortId) ?? new Set();
        set.add(enrollment.academicActorId);
        actorsByCohort.set(enrollment.cohortId, set);
    }

    const environmentsById = new Map(environments.map((env) => [env.environmentId, env]));

    // Mismo resumen agregado que estudiantes y fichas: la tarjeta de cada curso
    // mostraba "Asistencia promedio 0%" porque el dato nunca se pedía.
    const attendance = await optional(
        attendanceSummaryFor(enrollments.map((e) => e.academicActorId).filter((v) => v != null)),
        new Map()
    );
    const rateOf = (actorId) => {
        const counts = attendance.get(actorId);
        if (!counts?.total) return null;
        return Math.round(((counts.present + counts.late + counts.justified) / counts.total) * 100);
    };

    return courses.map((course, index) => {
        const courseBlocks = blocks.filter((block) => block.courseId === course.courseId);

        const studentIds = new Set();
        for (const cohortId of courseCohorts.get(course.courseId) ?? []) {
            for (const actorId of actorsByCohort.get(cohortId) ?? []) studentIds.add(actorId);
        }

        const professorNames = [];
        const instructorActorIds = [];
        for (const block of courseBlocks) {
            const person = personOf(block.instructorActorId, actors, persons);
            const name = fullName(person);
            if (name && !professorNames.includes(name)) professorNames.push(name);
            if (block.instructorActorId != null && !instructorActorIds.includes(block.instructorActorId)) {
                instructorActorIds.push(block.instructorActorId);
            }
        }

        const days = [];
        for (const block of courseBlocks) {
            const label = dayLabel(block.dayOfWeek);
            if (label && !days.includes(label)) days.push(label);
        }

        const environmentId = courseBlocks[0]?.environmentId;
        const environment = environmentId ? environmentsById.get(environmentId) : null;

        return {
            id: String(course.courseId),
            programId: course.programId ?? null,
            code: course.code ?? "",
            name: course.name ?? "",
            professor: professorNames.length ? professorNames.join(", ") : null,
            // IDs de los instructores (academic_actor_id) de los bloques de este curso.
            // Permite acotar "mis fichas" para el rol teacher; `professor` es solo el nombre.
            instructorActorIds,
            students: studentIds.size,
            schedule: days.join(", ") || null,
            room: environment ? String(environment.code ?? environment.name ?? "") : null,
            startDate: null, // sin fechas en el backend: el período muestra '—'
            endDate: null,
            semester: null,
            avgAttendance: (() => {
                const rates = [...studentIds].map(rateOf).filter((v) => v != null);
                return rates.length ? Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length) : 0;
            })(),
            status: normalizeStatus(course.status),
            color: colorAt(index),
            creditHours: course.creditHours ?? null,
        };
    });
}

function personOf(actorId, actors, persons) {
    const actor = actors.get(actorId);
    return actor?.personId ? persons.get(actor.personId) : null;
}

export async function loadCourses() {
    const local = await localCourses();
    try {
        return [...(await coursesFromApi()), ...local];
    } catch (error) {
        if (API_MODE === "mock") {
            console.warn("[FaceAttend] loadCourses: API no disponible, uso mock —", error?.message);
            return [...mockCourses, ...local];
        }
        throw error;
    }
}

// ── Escritura local (pendiente de cablear al backend) ─────

export async function saveCourses(courses) {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    } catch (error) { /* fallo silencioso */ }
}

export async function addCourse(existing, draft) {
    const newCourse = { 
        id: generateId(), 
        ...draft,
        // Asegurar campos por defecto
        avgAttendance: draft.avgAttendance || 0,
        students: draft.students || 0,
        status: draft.status || "active",
    };
    const updated = [...existing, newCourse];
    await saveCourses(updated);
    return updated;
}

export async function updateCourse(existing, id, patch) {
    const updated = existing.map(c => c.id === id ? { ...c, ...patch } : c);
    await saveCourses(updated);
    return updated;
}

export async function deleteCourse(existing, id) {
    const updated = existing.filter(c => c.id !== id);
    await saveCourses(updated);
    return updated;
}
