// ============================================================
//  FaceAttend EDU — Alta de períodos académicos y fichas (cohortes)
//
//  POST /api/v1/academic-periods { schoolId, name, startsOn, endsOn, isActive }
//  POST /api/v1/cohorts { programId, academicPeriodId, code, status }
//  Ambas FK (program_id, academic_period_id) son NOT NULL: sin las dos
//  no hay ficha posible. Los IDs se resuelven en tiempo de ejecución.
// ============================================================

import { academicApi } from "./academicApi";
import { resetReferenceData } from "./referenceData";

function periodIdOf(period) {
    return period?.academicPeriodId ?? period?.academic_period_id ?? period?.id ?? null;
}

function periodListOf(response) {
    if (Array.isArray(response)) return response;
    return response?.content ?? [];
}

function cohortIdOf(cohort) {
    return cohort?.cohortId ?? cohort?.cohort_id ?? cohort?.id ?? null;
}

/**
 * Períodos visibles: los de la sede, o todos si no hay contexto
 * (super admin global).
 */
export async function listSchoolPeriods(schoolId) {
    const res =
        schoolId == null
            ? await academicApi.listPeriods()
            : await academicApi.listSchoolPeriods(schoolId);
    return periodListOf(res)
        .map((p) => ({
            academicPeriodId: periodIdOf(p),
            schoolId: p?.schoolId ?? p?.school_id ?? schoolId ?? null,
            name: p?.name ?? "",
            startsOn: p?.startsOn ?? p?.starts_on ?? "",
            endsOn: p?.endsOn ?? p?.ends_on ?? "",
            isActive: p?.isActive ?? p?.is_active ?? false,
        }))
        .filter((p) => p.academicPeriodId != null);
}

/**
 * Crea un período académico en la sede indicada.
 * @throws si falta la sede, las fechas, o el backend rechaza el payload.
 */
export async function createPeriod({ schoolId, name, startsOn, endsOn, isActive = true }) {
    if (schoolId == null || String(schoolId).trim() === "") {
        throw new Error("A school is required");
    }
    const sid = Number(schoolId);
    if (!Number.isInteger(sid)) throw new Error("A school is required");
    if (!String(startsOn ?? "").trim() || !String(endsOn ?? "").trim()) {
        throw new Error("Start and end dates are required");
    }
    const created = await academicApi.createPeriod({
        schoolId: sid,
        name: String(name).trim(),
        startsOn: String(startsOn).trim(),
        endsOn: String(endsOn).trim(),
        isActive,
    });
    resetReferenceData();
    return {
        academicPeriodId: periodIdOf(created),
        schoolId: sid,
        name: created?.name ?? String(name).trim(),
        startsOn: created?.startsOn ?? String(startsOn).trim(),
        endsOn: created?.endsOn ?? String(endsOn).trim(),
        isActive: created?.isActive ?? isActive,
    };
}

/**
 * Crea una ficha (cohorte) en el programa y período indicados.
 * @throws si falta el programa/período, o el backend rechaza el payload.
 */
export async function createCohort({ programId, academicPeriodId, code }) {
    const pid = Number(programId);
    const perid = Number(academicPeriodId);
    if (!Number.isInteger(pid)) throw new Error("A program is required");
    if (!Number.isInteger(perid)) throw new Error("An academic period is required");
    if (!String(code ?? "").trim()) throw new Error("A code is required");

    const created = await academicApi.createCohort({
        programId: pid,
        academicPeriodId: perid,
        code: String(code).trim(),
        status: true,
    });
    resetReferenceData();
    return {
        cohortId: cohortIdOf(created),
        programId: pid,
        academicPeriodId: perid,
        code: created?.code ?? String(code).trim(),
        status: created?.status ?? true,
    };
}
