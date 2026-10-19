// ============================================================
//  FaceAttend EDU — Alta de cursos en el backend
//
//  POST /api/v1/courses { programId, code, name, status }.
//  `program_id` es FK NOT NULL: sin programa no hay curso.
//  Los IDs se resuelven en tiempo de ejecución (nunca hardcodeados)
//  y se aceptan respuestas camelCase o snake_case.
// ============================================================

import { academicApi } from "./academicApi";
import { resetReferenceData } from "./referenceData";

function programIdOf(program) {
    return program?.programId ?? program?.program_id ?? program?.id ?? null;
}

function programListOf(response) {
    if (Array.isArray(response)) return response;
    return response?.content ?? [];
}

/**
 * Programas visibles: los de la sede, o todos si no hay contexto
 * (super admin global).
 */
export async function listSchoolPrograms(schoolId) {
    const res =
        schoolId == null
            ? await academicApi.listPrograms()
            : await academicApi.listSchoolPrograms(schoolId);
    return programListOf(res)
        .map((p) => ({
            programId: programIdOf(p),
            schoolId: p?.schoolId ?? p?.school_id ?? schoolId ?? null,
            code: p?.code ?? "",
            name: p?.name ?? "",
        }))
        .filter((p) => p.programId != null);
}

/**
 * Crea un programa en la sede indicada. Sin esto no hay cursos ni fichas
 * posibles para una sede nueva: program_id es FK NOT NULL de ambas.
 * @throws si falta la sede o el backend rechaza el payload.
 */
export async function createProgram({ schoolId, code, name }) {
    if (schoolId == null || String(schoolId).trim() === "") {
        throw new Error("A school is required");
    }
    const sid = Number(schoolId);
    if (!Number.isInteger(sid)) throw new Error("A school is required");
    const created = await academicApi.createProgram({
        schoolId: sid,
        code: String(code).trim(),
        name: String(name).trim(),
        status: true,
    });
    // Los listPrograms()/listCourses()/listCohorts() de referenceData.js se
    // memorizan para toda la sesión: sin esto, lo que se acaba de crear no
    // aparece en ninguna pantalla que los use hasta cerrar sesión.
    resetReferenceData();
    return {
        programId: programIdOf(created),
        schoolId: sid,
        code: created?.code ?? String(code).trim(),
        name: created?.name ?? String(name).trim(),
    };
}

/**
 * Crea el curso en el programa indicado.
 * @throws si falta el programa o el backend rechaza el payload.
 */
export async function createCourse({ programId, code, name, creditHours }) {
    if (programId == null || String(programId).trim() === "") {
        throw new Error("A program is required");
    }
    const pid = Number(programId);
    if (!Number.isInteger(pid)) throw new Error("A program is required");
    const body = {
        programId: pid,
        code: String(code).trim(),
        name: String(name).trim(),
        status: true,
    };
    if (creditHours != null) body.creditHours = creditHours;
    const created = await academicApi.createCourse(body);
    resetReferenceData();
    return created;
}

/**
 * Edita nombre/código/programa de un curso ya existente.
 * @throws si falta el id, el programa o el backend rechaza el payload.
 */
export async function updateCourse(courseId, { programId, code, name, status, creditHours }) {
    if (courseId == null) throw new Error("A course is required");
    if (programId == null || String(programId).trim() === "") {
        throw new Error("A program is required");
    }
    const pid = Number(programId);
    if (!Number.isInteger(pid)) throw new Error("A program is required");
    const body = {
        programId: pid,
        code: String(code).trim(),
        name: String(name).trim(),
    };
    if (status !== undefined) body.status = status;
    if (creditHours !== undefined && creditHours !== null) body.creditHours = creditHours;
    const updated = await academicApi.updateCourse(courseId, body);
    resetReferenceData();
    return updated;
}

/**
 * Elimina un curso (HU-SCH-001, FR 8.1). Solo Super Admin en UI.
 * @throws si falta el id o el backend rechaza la operación.
 */
export async function deleteCourse(courseId) {
    if (courseId == null) throw new Error("A course is required");
    await academicApi.deleteCourse(courseId);
    resetReferenceData();
}

function normalizeProgramKey(value) {
    return String(value ?? "").trim().toLowerCase();
}

/**
 * Importación masiva: resuelve los programas una sola vez y crea
 * los cursos uno por uno. No se detiene ante fallos individuales.
 * @returns {{ success: number, errors: Array<{ course: string, reason: string }> }}
 */
export async function importCourses(schoolId, drafts) {
    const programs = await listSchoolPrograms(schoolId);
    const byKey = new Map();
    for (const program of programs) {
        if (normalizeProgramKey(program.code)) byKey.set(normalizeProgramKey(program.code), program);
        if (normalizeProgramKey(program.name)) byKey.set(normalizeProgramKey(program.name), program);
    }

    let success = 0;
    const errors = [];
    for (const draft of drafts ?? []) {
        const code = String(draft?.code ?? "").trim();
        const name = String(draft?.name ?? "").trim();
        const label = code || name || "Curso desconocido";
        if (!code || !name) {
            errors.push({ course: label, reason: "Código y nombre son requeridos" });
            continue;
        }
        const program = byKey.get(normalizeProgramKey(draft?.program));
        if (!program) {
            errors.push({ course: label, reason: "Programa no encontrado en la sede" });
            continue;
        }
        try {
            await createCourse({ programId: program.programId, code, name });
            success += 1;
        } catch (e) {
            errors.push({ course: label, reason: e?.message || "El backend rechazó el curso" });
        }
    }
    return { success, errors };
}
