// ============================================================
//  FaceAttend EDU — StudentStorage
//
//  Lectura de estudiantes: API académica (GET /academic-actors
//  filtrado por actor type STUDENT + /persons) con los mocks
//  como respaldo si falla.
//
//  Derivados que el backend aún no expone y se calculan aquí:
//  - course: cohorte matriculado -> bloques -> código del curso
//  - attendance: 0 hasta la fase de consulta de asistencia
//  - hasFacial / hasFingerprint: false (sin dato biométrico en
//    esta lista; el detalle biométrico es otra petición)
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_MODE } from "../../config/env";
import { mockStudents } from "./mockData";
import {
    actorTypeMap,
    attendanceSummaryFor,
    cohortMap,
    courseMap,
    fullName,
    listActors,
    listBlocks,
    listEnrollments,
    normalizeStatus,
    optional,
    personMap,
    userByPersonMap,
} from "../../services/api/referenceData";

const STORAGE_KEY = "@faceattend_students";
const LOCAL_PREFIX = "s_";

// ── Genera un ID único simple ──────────────────────────────

function generateId() {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Lectura ───────────────────────────────────────────────

async function localStudents() {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (student) => typeof student?.id === "string" && student.id.startsWith(LOCAL_PREFIX)
        );
    } catch {
        return [];
    }
}

async function studentsFromApi() {
    // Tipos de actor y personas son necesarios: sin ellos no hay nombres
    // ni forma de separar estudiantes de instructores.
    const [actors, actorTypes, persons] = await Promise.all([
        listActors(),
        actorTypeMap(),
        personMap(),
    ]);
    if (!Array.isArray(actors)) return [];

    const studentType = [...actorTypes.values()].find(
        (type) => String(type.code ?? "").toUpperCase() === "STUDENT"
    );
    if (!studentType) throw new Error("no hay actor type STUDENT en el backend");

    const [enrollments, cohorts, blocks, courses, usersByPerson] = await Promise.all([
        optional(listEnrollments(), []),
        optional(cohortMap(), new Map()),
        optional(listBlocks(), []),
        optional(courseMap(), new Map()),
        // Cuenta del estudiante (username): sin ella el formulario de edición
        // lo pide vacío y no deja guardar. Vacío si el rol no puede listar /users.
        optional(userByPersonMap(), new Map()),
    ]);

    const cohortOfActor = new Map(
        enrollments
            .filter((e) => String(e.enrollmentStatus ?? "").toLowerCase() !== "withdrawn")
            .map((e) => [e.academicActorId, e.cohortId])
    );

    // Un cohorte/ficha cursa VARIOS cursos a la vez (un schedule_block por
    // curso, cada uno con su propio instructor) — por eso se guarda el Set
    // completo, no solo "el primer bloque encontrado": con un solo curso por
    // cohorte, un estudiante quedaba con el curso equivocado en cuanto su
    // ficha tenía más de un bloque (p. ej. Cálculo en vez de Programación),
    // y no aparecía entre los estudiantes del instructor que sí lo tiene.
    const coursesByCohort = new Map();
    for (const block of blocks) {
        if (!block.cohortId || !block.courseId) continue;
        const set = coursesByCohort.get(block.cohortId) ?? new Set();
        set.add(block.courseId);
        coursesByCohort.set(block.cohortId, set);
    }
    // Compat: "el" curso de la ficha para las columnas que muestran uno solo
    // (p. ej. "Programa" en la tabla de usuarios). Resuelto por orden de
    // bloques; se mantiene por compatibilidad visual, no para cruces de datos.
    const courseByCohort = new Map();
    for (const block of blocks) {
        if (block.cohortId && block.courseId && !courseByCohort.has(block.cohortId)) {
            courseByCohort.set(block.cohortId, block.courseId);
        }
    }

    const students = actors.filter((actor) => actor.actorTypeId === studentType.actorTypeId);

    // Porcentaje real de asistencia. Antes esta lista salía con attendance: 0 para
    // todos y nadie pedía nunca los registros, así que la vista de Reportes y los
    // indicadores del panel se calculaban sobre ceros: 0 % global y el 100 % de los
    // estudiantes marcados "en riesgo". El resumen llega agregado en SQL.
    const attendance = await optional(
        attendanceSummaryFor(students.map((actor) => actor.academicActorId)),
        new Map()
    );
    // Asistió = no estuvo ausente; la tardanza cuenta como asistencia y la
    // puntualidad se mide aparte.
    const rateOf = (actorId) => {
        const counts = attendance.get(actorId);
        if (!counts?.total) return 0;
        return Math.round(((counts.present + counts.late + counts.justified) / counts.total) * 100);
    };

    return students
        .map((actor) => {
            const person = persons.get(actor.personId);
            const cohortId = cohortOfActor.get(actor.academicActorId);
            const cohort = cohortId ? cohorts.get(cohortId) : null;
            const courseId = cohortId ? courseByCohort.get(cohortId) : null;
            const course = courseId ? courses.get(courseId) : null;
            const courseIds = cohortId
                ? [...(coursesByCohort.get(cohortId) ?? [])].map(String)
                : [];

            return {
                id: String(actor.academicActorId),
                name: fullName(person) || actor.actorCode || "",
                email: person?.email ?? "",
                code: actor.actorCode ?? "",
                // Sede del actor: permite al super admin agregar los reportes
                // por escuela en vez de por persona.
                schoolId: actor.schoolId != null ? String(actor.schoolId) : null,
                course: course?.code ?? "", // vacío: la UI lo omite de los programas
                // El código y el nombre del curso se repiten entre sedes ("MAT" existe
                // en las dos), así que buscar por ellos cuelga al estudiante del curso
                // equivocado. El id sí es único: es el que debe usarse para cruzar.
                courseId: courseId != null ? String(courseId) : null,
                // Todos los cursos de la ficha del estudiante (no solo el primero):
                // para acotar "mis estudiantes" (teacher) por curso hay que mirar
                // todos, no asumir uno solo por ficha.
                courseIds,
                // Ficha (cohort) del estudiante: compañeros = misma cohortId.
                cohortId: cohortId != null ? String(cohortId) : null,
                grade: null, // lo rellena AppDataContext con el período del curso
                attendance: rateOf(actor.academicActorId),
                status: normalizeStatus(actor.status),
                hasFacial: false,
                hasFingerprint: false,
                document: person?.documentNumber ?? "",
                documentNumber: person?.documentNumber ?? "",
                documentType: person?.documentType ?? "",
                bloodType: person?.bloodType ?? "",
                birthDate: person?.birthDate ? String(person.birthDate).slice(0, 10) : "",
                address: person?.address ?? "",
                phone: person?.phone ?? "",
                ficha: cohort?.code ?? "",
                personId: actor.personId,
                username: usersByPerson.get(actor.personId)?.username ?? "",
            };
        });
}

/**
 * Carga todos los estudiantes: API primero, mocks como respaldo,
 * fusionados con las altas hechas localmente en la UI.
 */
export async function loadStudents() {
    const local = await localStudents();
    try {
        return [...(await studentsFromApi()), ...local];
    } catch (error) {
        if (API_MODE === "mock") {
            console.warn("[FaceAttend] loadStudents: API no disponible, uso mock —", error?.message);
            return [...mockStudents, ...local];
        }
        throw error;
    }
}

// ── Escritura local (pendiente de cablear al backend) ─────

export async function saveStudents(students) {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    } catch (error) {
        // fallo silencioso — la UI ya tiene el estado en memoria
    }
}

export async function addStudent(existing, draft) {
    const newStudent = { id: generateId(), ...draft };
    const updated = [...existing, newStudent];
    await saveStudents(updated);
    return updated;
}

export async function addStudentsBulk(existing, drafts) {
    const newStudents = drafts.map(d => ({
        id: generateId(),
        ...d,
    }));
    const updated = [...existing, ...newStudents];
    await saveStudents(updated);
    return updated;
}
