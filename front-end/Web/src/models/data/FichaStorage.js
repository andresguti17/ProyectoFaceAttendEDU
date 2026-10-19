// ============================================================
//  FaceAttend EDU — FichaStorage
//
//  Lectura de fichas (cohortes): API académica (GET /cohorts,
//  /programs, /enrollments, /schedule-blocks) con los mocks
//  como respaldo si falla.
//
//  Derivados que el backend aún no expone y se calculan aquí:
//  - instructor: desde los bloques del cohorte (actor -> persona)
//  - totalStudents / activeStudents: matrículas del cohorte
//  - avgAttendance / presentToday / atRisk...: 0 hasta la fase
//    de consulta de asistencia
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_MODE } from "../../config/env";
import { mockFichas } from "./mockData";
import { colorAt } from "../../core/constants/dataColors";
import {
    actorMap,
    attendanceSummaryFor,
    fullName,
    listBlocks,
    listCohorts,
    listEnrollments,
    listPrograms,
    normalizeStatus,
    optional,
    personMap,
    userByPersonMap,
} from "../../services/api/referenceData";

const STORAGE_KEY = "@faceattend_fichas";
const LOCAL_PREFIX = "f_";

// ── Genera un ID único simple ──────────────────────────────

function generateId() {
    return `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Asignar colores si no los tienen ───────────────────────

function ensureFichasHaveColors(fichas) {
    return fichas.map((f, i) => ({
        ...f,
        color: f.color || colorAt(i),
    }));
}

// ── Lectura ───────────────────────────────────────────────

async function localFichas() {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (ficha) => typeof ficha?.id === "string" && ficha.id.startsWith(LOCAL_PREFIX)
        );
    } catch {
        return [];
    }
}

async function fichasFromApi() {
    const cohorts = await listCohorts();
    if (!Array.isArray(cohorts)) return [];

    const [programs, enrollments, blocks, actors, persons, usersByPerson] = await Promise.all([
        optional(listPrograms(), []),
        optional(listEnrollments(), []),
        optional(listBlocks(), []),
        optional(actorMap(), new Map()),
        optional(personMap(), new Map()),
        optional(userByPersonMap(), new Map()),
    ]);

    const programsById = new Map(programs.map((program) => [program.programId, program]));

    // Asistencia por ficha, del mismo resumen agregado que usan los estudiantes.
    // Estaba fija en 0, y como el panel saca "Asistencia global" promediando las
    // fichas, ese indicador salía siempre 0,0 %.
    const attendance = await optional(
        attendanceSummaryFor(enrollments.map((e) => e.academicActorId).filter((v) => v != null)),
        new Map()
    );
    const rateOf = (actorId) => {
        const counts = attendance.get(actorId);
        if (!counts?.total) return null;
        return Math.round(((counts.present + counts.late + counts.justified) / counts.total) * 100);
    };

    return cohorts.map((cohort) => {
        const cohortEnrollments = enrollments.filter((e) => e.cohortId === cohort.cohortId);
        const notWithdrawn = cohortEnrollments.filter(
            (e) => String(e.enrollmentStatus ?? "").toLowerCase() !== "withdrawn"
        );
        const active = cohortEnrollments.filter(
            (e) => String(e.enrollmentStatus ?? "").toLowerCase() === "active"
        );

        // Instructor: el primer bloque del cohorte trae al docente a cargo
        let instructorName = "";
        let instructorId = null;
        for (const block of blocks) {
            if (block.cohortId !== cohort.cohortId) continue;
            const actor = actors.get(block.instructorActorId);
            const person = actor?.personId ? persons.get(actor.personId) : null;
            const user = actor?.personId ? usersByPerson.get(actor.personId) : null;
            const name = fullName(person);
            if (name) {
                instructorName = name;
                instructorId = user?.userId ?? null;
                break;
            }
        }

        const program = programsById.get(cohort.programId);

        const rates = notWithdrawn.map((e) => rateOf(e.academicActorId)).filter((v) => v != null);
        const avgAttendance = rates.length
            ? Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length)
            : 0;

        return {
            id: String(cohort.cohortId),
            code: cohort.code ?? "",
            name: program?.name ?? cohort.code ?? "",
            program: program?.code ?? "",
            instructor: instructorName,
            instructorId,
            totalStudents: notWithdrawn.length,
            activeStudents: active.length,
            avgAttendance,
            presentToday: 0, // pendiente: exige agregar por fecha, no por actor
            lateToday: 0,
            absentToday: 0,
            atRiskStudents: rates.filter((r) => r < 75).length,
            excellentStudents: rates.filter((r) => r === 100).length,
            status: normalizeStatus(cohort.status),
        };
    });
}

/**
 * Carga todas las fichas: API primero, mocks como respaldo,
 * fusionadas con las altas hechas localmente en la UI.
 */
export async function loadFichas() {
    const local = await localFichas();
    try {
        return ensureFichasHaveColors([...(await fichasFromApi()), ...local]);
    } catch (error) {
        if (API_MODE === "mock") {
            console.warn("[FaceAttend] loadFichas: API no disponible, uso mock —", error?.message);
            return ensureFichasHaveColors([...mockFichas, ...local]);
        }
        throw error;
    }
}

// ── Escritura local (pendiente de cablear al backend) ─────

export async function saveFichas(fichas) {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fichas));
    } catch (error) {
        // fallo silencioso — la UI ya tiene el estado en memoria
    }
}

export async function addFicha(existing, draft) {
    const newFicha = {
        id: generateId(),
        color: draft.color || colorAt(existing.length),
        ...draft,
    };
    const updated = [...existing, newFicha];
    await saveFichas(updated);
    return updated;
}

export async function updateFicha(existing, id, patch) {
    const updated = existing.map((f) => (f.id === id ? { ...f, ...patch } : f));
    await saveFichas(updated);
    return updated;
}

export async function deleteFicha(existing, id) {
    const updated = existing.filter((f) => f.id !== id);
    await saveFichas(updated);
    return updated;
}
