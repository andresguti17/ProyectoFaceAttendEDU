// ============================================================
//  FaceAttend EDU — History ViewModel
// ============================================================
//  RESPONSABILIDAD: Consulta de historial de asistencia (HU-HIST-001)
//
//  ✓ Acota la consulta por rol (AC10 alumno / AC11 instructor / AC12 admin)
//  ✓ Combina registro + sesión + bloque para mostrar fecha, ficha,
//    ambiente, instructor y curso de cada marca (AC14)
//  ✓ Combina filtros (AC9) y pagina el resultado (AC15)
//
//  El backend no implementa el endpoint propuesto por la HU
//  (GET /attendance/history): la consulta se arma con
//  GET /academic-actors/{id}/attendance por persona del alcance.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { batched } from "../core/utils/batching";
import { attendanceApi, schedulingApi } from "../services/api";
import {
    listBlocks,
    listCohorts,
    listEnvironments,
    optional,
    personMap,
    actorMap,
} from "../services/api/referenceData";

export const PAGE_SIZE = 20;

// El endpoint de registros no pagina: pedir de más personas en un solo
// disparo satura el servicio (cada llamada recorre los ~81k registros),
// así que además se limita el alcance y se piden en grupos de 4.
const MAX_SCOPE_ACTORS = 50;

export const STATUS_OPTIONS = ["Present", "Absent", "Late", "Justified"];
export const PERIOD_OPTIONS = ["all", "today", "7", "30", "month"];

function localIso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
    ).padStart(2, "0")}`;
}

function periodStart(period) {
    const now = new Date();
    if (period === "today") return localIso(now);
    if (period === "7" || period === "30") {
        const from = new Date(now);
        from.setDate(from.getDate() - (Number(period) - 1));
        return localIso(from);
    }
    if (period === "month") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    return null;
}

function timeOf(instant) {
    if (!instant) return "";
    const text = String(instant);
    const part = text.includes("T") ? text.split("T")[1] : (text.split(" ")[1] || "");
    return part.slice(0, 5);
}

const EMPTY_LOOKUPS = {
    sessions: [],
    blocks: [],
    cohorts: [],
    environments: [],
    actors: null,
    persons: null,
};

export function useHistoryViewModel() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const appData = useAppData();

    const [isLoading, setIsLoading] = useState(false);
    const [isPreparing, setIsPreparing] = useState(true);
    const [hasQueried, setHasQueried] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [joined, setJoined] = useState([]);
    const [page, setPage] = useState(0);
    const [lookups, setLookups] = useState(EMPTY_LOOKUPS);

    const [filters, setFilters] = useState({
        period: "all",
        status: "",
        cohortId: "",
        personId: "",
        environmentId: "",
        instructorId: "",
    });

    // Catálogos que alimentan los filtros y el cruce de datos: una sola carga.
    useEffect(() => {
        let alive = true;
        (async () => {
            const [sessions, blocks, cohorts, environments, actors, persons] = await Promise.all([
                optional(schedulingApi.listSessions(), []),
                optional(listBlocks(), []),
                optional(listCohorts(), []),
                optional(listEnvironments(), []),
                optional(actorMap(), null),
                optional(personMap(), null),
            ]);
            if (!alive) return;
            setLookups({ sessions, blocks, cohorts, environments, actors, persons });
            setIsPreparing(false);
        })();
        return () => {
            alive = false;
        };
    }, []);

    // ── Alcance por rol (AC10/AC11/AC12) ────────────────────
    const scope = useMemo(() => {
        if (!user) return { kind: null, label: "", students: [] };
        const students = appData.students || [];

        if (user.role === "student") {
            const me = students.find((s) => s.personId === user.personId) || null;
            return { kind: "student", label: t("Tu registro de asistencia"), students: me ? [me] : [] };
        }

        if (user.role === "teacher") {
            const myCourseIds = (appData.courses || [])
                .filter(
                    (c) =>
                        Array.isArray(c.instructorActorIds) &&
                        c.instructorActorIds.includes(user.academicActorId)
                )
                .map((c) => c.id);
            const mine = students.filter(
                (s) => Array.isArray(s.courseIds) && s.courseIds.some((id) => myCourseIds.includes(id))
            );
            return { kind: "teacher", label: t("Asistencia de tus estudiantes"), students: mine };
        }

        // El super admin no tiene sede propia: no se le habla de "tu sede".
        return {
            kind: "admin",
            label: user.schoolId != null ? t("Asistencia de toda tu sede") : t("Asistencia registrada"),
            students,
        };
    }, [user, appData.students, appData.courses, t]);

    // ── Opciones de filtros ──────────────────────────────────
    const personOptions = useMemo(
        () =>
            scope.students
                .slice()
                .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                .map((s) => ({ value: String(s.id), label: s.name || String(s.id) })),
        [scope.students]
    );

    const cohortOptions = useMemo(() => {
        if (scope.kind === "student") return [];
        const used = new Set(scope.students.map((s) => s.cohortId).filter(Boolean));
        return lookups.cohorts
            .filter((c) => used.has(String(c.cohortId)) || used.has(Number(c.cohortId)))
            .map((c) => ({ value: String(c.cohortId), label: c.code || String(c.cohortId) }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [lookups.cohorts, scope]);

    const environmentOptions = useMemo(
        () =>
            lookups.environments.map((e) => ({
                value: String(e.environmentId),
                label: e.name || e.code || String(e.environmentId),
            })),
        [lookups.environments]
    );

    // Instructores: los que aparecen en los bloques del alcance del usuario.
    const instructorOptions = useMemo(() => {
        const cohortIds = new Set(scope.students.map((s) => String(s.cohortId)).filter(Boolean));
        const ids = new Set();
        for (const block of lookups.blocks) {
            if (scope.kind !== "admin" && !cohortIds.has(String(block.cohortId))) continue;
            if (block.instructorActorId != null) ids.add(Number(block.instructorActorId));
        }
        return [...ids]
            .map((id) => {
                const actor = lookups.actors instanceof Map ? lookups.actors.get(id) : null;
                const person = lookups.persons instanceof Map ? lookups.persons.get(actor?.personId) : null;
                const label = person
                    ? `${person.name ?? ""} ${person.lastName ?? ""}`.trim()
                    : actor?.actorCode || String(id);
                return { value: String(id), label };
            })
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [lookups, scope]);

    const setFilter = useCallback((key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(0);
    }, []);

    const resetFilters = useCallback(() => {
        setFilters({ period: "all", status: "", cohortId: "", personId: "", environmentId: "", instructorId: "" });
        setPage(0);
        setNotice(null);
        setError(null);
    }, []);

    // ── Consulta (AC1..AC9) ──────────────────────────────────
    const runQuery = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setNotice(null);

        try {
            // Persona y ficha acotan cuántas peticiones se hacen (AC11/AC12);
            // el resto de filtros se aplican sobre el resultado ya unido.
            let targets = scope.students;
            if (scope.kind !== "student") {
                if (filters.personId) {
                    targets = targets.filter((s) => String(s.id) === String(filters.personId));
                }
                if (filters.cohortId) {
                    targets = targets.filter((s) => String(s.cohortId) === String(filters.cohortId));
                }
            }

            if (targets.length === 0) {
                setJoined([]);
                setHasQueried(true);
                setNotice(t("No hay personas en tu alcance con esos filtros."));
                return;
            }

            if (targets.length > MAX_SCOPE_ACTORS) {
                setJoined([]);
                setHasQueried(true);
                setError(
                    t(
                        "La consulta supera el máximo de personas permitido. Selecciona una ficha o una persona para acotarla."
                    )
                );
                return;
            }

            // En secuencia (size 1): el backend resuelve byActor con findAll y
            // en paralelo agotaba el heap de ms-attendance (OutOfMemoryError),
            // dejando el servicio sin responder para todos.
            const recordLists = await batched(
                targets,
                (s) => attendanceApi.recordsByActor(Number(s.id)).catch(() => []),
                1
            );

            const sessionById = new Map(lookups.sessions.map((s) => [Number(s.classSessionId), s]));
            const blockById = new Map(lookups.blocks.map((b) => [Number(b.scheduleBlockId), b]));
            const cohortById = new Map(lookups.cohorts.map((c) => [Number(c.cohortId), c]));
            const envById = new Map(lookups.environments.map((e) => [Number(e.environmentId), e]));
            const courseById = new Map(
                (appData.courses || []).map((c) => [Number(c.id ?? c.courseId), c])
            );
            const cohortCode = (id) => cohortById.get(Number(id))?.code ?? "";

            const built = [];
            recordLists.forEach((records, index) => {
                const student = targets[index];
                for (const record of records || []) {
                    const session = sessionById.get(Number(record.classSessionId));
                    const block = session ? blockById.get(Number(session.scheduleBlockId)) : null;
                    const cohortId = block ? String(block.cohortId) : student.cohortId;
                    const course = block ? courseById.get(Number(block.courseId)) : null;
                    const actor = block && lookups.actors instanceof Map
                        ? lookups.actors.get(Number(block.instructorActorId))
                        : null;
                    const person = actor && lookups.persons instanceof Map
                        ? lookups.persons.get(actor.personId)
                        : null;

                    built.push({
                        key: String(record.attendanceRecordId),
                        recordId: record.attendanceRecordId,
                        personName: student.name || String(student.id),
                        date:
                            session?.sessionDate ||
                            (record.capturedAt ? String(record.capturedAt).slice(0, 10) : ""),
                        time: timeOf(record.capturedAt),
                        status: record.attendanceStatus,
                        captureMethod: record.captureMethod,
                        cohortId,
                        cohort: cohortCode(cohortId) || student.ficha || "",
                        course: course?.name ?? "",
                        environmentId: block ? String(block.environmentId) : "",
                        environment: block ? envById.get(Number(block.environmentId))?.name ?? "" : "",
                        instructorId: block ? String(block.instructorActorId) : "",
                        instructor: person
                            ? `${person.name ?? ""} ${person.lastName ?? ""}`.trim()
                            : actor?.actorCode ?? "",
                    });
                }
            });

            setJoined(built);
            setHasQueried(true);
            setPage(0);
        } catch (e) {
            setJoined([]);
            setError(e?.message || t("No se pudo consultar el historial de asistencia."));
        } finally {
            setIsLoading(false);
        }
    }, [filters, scope, lookups, appData.courses, t]);

    // ── Filtros aplicados al resultado ya unido (AC9) ────────
    const rows = useMemo(() => {
        const from = periodStart(filters.period);
        return joined
            .filter((row) => {
                if (filters.status && row.status !== filters.status) return false;
                if (filters.environmentId && row.environmentId !== filters.environmentId) return false;
                if (filters.instructorId && row.instructorId !== filters.instructorId) return false;
                if (filters.cohortId && String(row.cohortId) !== String(filters.cohortId)) return false;
                if (from && row.date && row.date < from) return false;
                return true;
            })
            .sort((a, b) => {
                const byDate = String(b.date).localeCompare(String(a.date));
                return byDate !== 0 ? byDate : String(b.time).localeCompare(String(a.time));
            });
    }, [joined, filters]);

    const stats = useMemo(
        () =>
            rows.reduce(
                (acc, row) => {
                    acc.total += 1;
                    if (row.status === "Present") acc.present += 1;
                    else if (row.status === "Absent") acc.absent += 1;
                    else if (row.status === "Late") acc.late += 1;
                    else if (row.status === "Justified") acc.justified += 1;
                    return acc;
                },
                { total: 0, present: 0, absent: 0, late: 0, justified: 0 }
            ),
        [rows]
    );

    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    return {
        isLoading,
        isPreparing,
        hasQueried,
        error,
        notice,
        scope,
        filters,
        setFilter,
        resetFilters,
        runQuery,
        rows,
        pageRows,
        stats,
        page: safePage,
        pageCount,
        setPage,
        statusOptions: STATUS_OPTIONS,
        periodOptions: PERIOD_OPTIONS,
        cohortOptions,
        personOptions,
        environmentOptions,
        instructorOptions,
    };
}
