// ============================================================
//  FaceAttend EDU — Academic ViewModel
// ============================================================
//  RESPONSABILIDAD: Sección académica en modo lectura
//  (nav-map /academic · mínima rol: alumno, instructor y admin)
//
//  Muestra los programas, períodos, fichas y cursos de la sede.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { academicApi } from "../services/api";
import { createProgram } from "../services/api/courseCreation";
import { createPeriod } from "../services/api/fichaCreation";
import { resetReferenceData } from "../services/api/referenceData";
import { getActiveSchool, listCohorts, listCourses, listPrograms, optional } from "../services/api/referenceData";

// Suma un mes calendario a una fecha ISO (AAAA-MM-DD), respetando el último
// día del mes destino (31 de enero → 28/29 de febrero). Se usa para exigir una
// duración mínima de un mes en el período académico.
function addOneMonth(isoDate) {
    const [y, m, d] = isoDate.split("-").map(Number);
    // m (0-based) ya apunta al mes siguiente al original.
    const daysInTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const day = Math.min(d, daysInTarget);
    return new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
}

export function useAcademicViewModel() {
    const { user } = useAuth();
    const appData = useAppData();
    const { t } = useTranslation();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [programs, setPrograms] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [cohorts, setCohorts] = useState([]);
    const [courses, setCourses] = useState([]);

    const schoolId = user?.schoolId ?? getActiveSchool();

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [programList, periodList, cohortList, courseList] = await Promise.all([
                optional(listPrograms(), []),
                schoolId != null
                    ? optional(academicApi.listSchoolPeriods(schoolId), [])
                    : Promise.resolve([]),
                optional(listCohorts(), []),
                optional(listCourses(), []),
            ]);
            setPrograms(programList);
            setPeriods(periodList);
            setCohorts(cohortList);
            setCourses(courseList);
        } catch (e) {
            setError(e?.message || t("No se pudo cargar la sección académica."));
        } finally {
            setIsLoading(false);
        }
    }, [schoolId, t]);

    useEffect(() => {
        // Deps en [load]: si la sesión resuelve la sede DESPUÉS del montaje,
        // load se recrea y se vuelve a pedir; con [] los períodos se saltaban.
        load();
    }, [load]);

    const programName = useCallback(
        (programId) => programs.find((p) => Number(p.programId) === Number(programId))?.name || "—",
        [programs]
    );

    // El estudiante solo ve la ficha que cursa (no todas las de la sede).
    const myCohortId =
        user?.role === "student"
            ? (appData.students || []).find((s) => s.personId === user.personId)?.cohortId ?? null
            : null;
    const visibleCohorts =
        user?.role === "student" && myCohortId != null
            ? cohorts.filter((cohort) => Number(cohort.cohortId) === Number(myCohortId))
            : cohorts;

    // Activar/desactivar + eliminar lógico (HU-ACAD-002/004, FR 2.2).
    // El backend expone PUT + DELETE; la UI usa ConfirmModal antes de llamar.
    const toggleProgramStatus = useCallback(
        async (program) => {
            const id = program?.programId;
            if (id == null) return "Falta el programa";
            const next = !(program.status !== false);
            try {
                await academicApi.updateProgram(id, { status: next });
            } catch (e) {
                return e?.message || "No se pudo actualizar el programa";
            }
            resetReferenceData();
            setPrograms((prev) => prev.map((p) => (p.programId === id ? { ...p, status: next } : p)));
            return null;
        },
        []
    );

    const removeProgram = useCallback(async (program) => {
        const id = program?.programId;
        if (id == null) return "Falta el programa";
        try {
            await academicApi.deleteProgram(id);
        } catch (e) {
            return e?.message || "No se pudo eliminar el programa";
        }
        resetReferenceData();
        setPrograms((prev) => prev.filter((p) => p.programId !== id));
        return null;
    }, []);

    const togglePeriodStatus = useCallback(async (period) => {
        const id = period?.academicPeriodId;
        if (id == null) return "Falta el período";
        const next = !period.isActive;
        try {
            await academicApi.updatePeriod(id, { isActive: next });
        } catch (e) {
            return e?.message || "No se pudo actualizar el período";
        }
        resetReferenceData();
        setPeriods((prev) =>
            prev.map((p) => (p.academicPeriodId === id ? { ...p, isActive: next } : p))
        );
        return null;
    }, []);

    const removePeriod = useCallback(async (period) => {
        const id = period?.academicPeriodId;
        if (id == null) return "Falta el período";
        try {
            await academicApi.deletePeriod(id);
        } catch (e) {
            return e?.message || "No se pudo eliminar el período";
        }
        resetReferenceData();
        setPeriods((prev) => prev.filter((p) => p.academicPeriodId !== id));
        return null;
    }, []);

    const toggleCohortStatus = useCallback(async (cohort) => {
        const id = cohort?.cohortId;
        if (id == null) return "Falta la ficha";
        const next = !(cohort.status !== false);
        try {
            await academicApi.updateCohort(id, { status: next });
        } catch (e) {
            return e?.message || "No se pudo actualizar la ficha";
        }
        resetReferenceData();
        setCohorts((prev) => prev.map((c) => (c.cohortId === id ? { ...c, status: next } : c)));
        return null;
    }, []);

    const removeCohort = useCallback(async (cohort) => {
        const id = cohort?.cohortId;
        if (id == null) return "Falta la ficha";
        try {
            await academicApi.deleteCohort(id);
        } catch (e) {
            return e?.message || "No se pudo eliminar la ficha";
        }
        resetReferenceData();
        setCohorts((prev) => prev.filter((c) => c.cohortId !== id));
        return null;
    }, []);

    // Crear/editar programa (HU-ACAD-002, FR 2.2). schoolId obligatorio al crear.
    const saveProgram = useCallback(
        async ({ programId, code, name }) => {
            if (!String(code ?? "").trim()) return "El código es requerido";
            if (!String(name ?? "").trim()) return "El nombre es requerido";
            try {
                if (programId == null) {
                    if (schoolId == null) return "Falta la sede";
                    await createProgram({
                        schoolId,
                        code: String(code).trim(),
                        name: String(name).trim(),
                    });
                } else {
                    await academicApi.updateProgram(programId, {
                        code: String(code).trim(),
                        name: String(name).trim(),
                    });
                    resetReferenceData();
                }
            } catch (e) {
                return e?.message || "No se pudo guardar el programa";
            }
            await load();
            return null;
        },
        [schoolId, load]
    );

    // Crear/editar período académico (HU-ACAD-002). chk_period_dates: inicio < fin.
    const savePeriod = useCallback(
        async ({ academicPeriodId, name, startsOn, endsOn }) => {
            if (!String(name ?? "").trim()) return "El nombre es requerido";
            const from = String(startsOn ?? "").trim();
            const to = String(endsOn ?? "").trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
                return "Las fechas deben tener formato AAAA-MM-DD";
            }
            if (from >= to) return "El inicio debe ser anterior al fin";

            // Reglas razonables de negocio:
            // 1) Un período nuevo no puede iniciar en el pasado.
            // 2) Duración mínima de un mes calendario.
            // 3) No solaparse con otro período activo de la misma sede.
            const todayIso = new Date().toISOString().slice(0, 10);
            if (academicPeriodId == null && from < todayIso) {
                return "El período nuevo no puede iniciar en el pasado";
            }
            if (to < addOneMonth(from)) {
                return "El período debe durar al menos un mes";
            }
            const overlaps = (periods ?? []).some(
                (p) =>
                    p?.academicPeriodId !== academicPeriodId &&
                    p?.isActive &&
                    from < String(p?.endsOn ?? "") &&
                    to > String(p?.startsOn ?? "")
            );
            if (overlaps) return "Se solapa con otro período activo de la sede";

            try {
                if (academicPeriodId == null) {
                    if (schoolId == null) return "Falta la sede";
                    await createPeriod({
                        schoolId,
                        name: String(name).trim(),
                        startsOn: from,
                        endsOn: to,
                    });
                } else {
                    await academicApi.updatePeriod(academicPeriodId, {
                        name: String(name).trim(),
                        startsOn: from,
                        endsOn: to,
                    });
                    resetReferenceData();
                }
            } catch (e) {
                return e?.message || "No se pudo guardar el período";
            }
            await load();
            return null;
        },
        [schoolId, periods, load]
    );

    return {
        isLoading,
        error,
        programs,
        periods,
        cohorts: visibleCohorts,
        courses,
        // false cuando la sesión no tiene sede (super admin): no se le habla
        // de "tu sede" porque no pertenece a ninguna.
        hasSchool: schoolId != null,
        programName,
        refresh: load,
        toggleProgramStatus,
        removeProgram,
        togglePeriodStatus,
        removePeriod,
        toggleCohortStatus,
        removeCohort,
        saveProgram,
        savePeriod,
    };
}
