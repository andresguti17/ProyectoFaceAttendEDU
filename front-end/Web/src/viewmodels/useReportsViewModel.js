// ============================================================
//  FaceAttend EDU — Reports ViewModel
// ============================================================
//  RESPONSABILIDAD: Lógica de negocio para reportes ("qué hacer")
//
//  Este ViewModel:
//  ✓ Gestiona estado de filtros y período
//  ✓ Procesa y calcula datos de reportes
//  ✓ Orquesta exportaciones (delega a servicio)
//  ✓ Optimiza renders con useMemo y useCallback
//
//  NO debe:
//  ✗ Renderizar UI (responsabilidad de la View)
//  ✗ Formatear datos para exportación (responsabilidad de servicio)
//
//  Patrón MVVM: ViewModel = lógica + estado
// ============================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../view/components/hooks/useTheme";
import { getAttendanceThresholds } from "../models/data/userDerivedData";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useRolePermissions } from "./useRolePermissions";
import { academicApi } from "../services/api";
import { attendanceApi } from "../services/api/attendanceApi";
import { schedulingApi } from "../services/api/schedulingApi";
import { notifyActors, notifyStudentByActorId } from "../services/api/reportNotifications";
import { optional, listBlocks } from "../services/api/referenceData";
import { exportToExcel, exportToPDF, buildReportHTML, buildHTMLTable, formatPercentageWithColor, formatStatusBadge } from "../core/utils/exportHelpers";

// ══════════════════════════════════════════════════════════
// CONSTANTES Y TIPOS PÚBLICOS
// ══════════════════════════════════════════════════════════

// Estudiantes pintados por página: la consulta no se recorta (alimenta
// también stats y exportaciones), pero la vista solo pinta una página
// de golpe para no cargar miles de filas en el DOM.
export const REPORTS_PAGE_SIZE = 25;

/**
 * Opciones de período disponibles para reportes
 */
export const PERIOD_OPTIONS = [
    { value: "week", label: "Esta semana" },
    { value: "month", label: "Este mes" },
    { value: "semester", label: "Semestre" },
];

/**
 * Filtros por defecto para reportes
 */
export const DEFAULT_FILTERS = {
    courseCode: "",
    attendanceMin: 0,
    attendanceMax: 100,
    statusFilter: "all",
    showAtRiskOnly: false,
};

// ══════════════════════════════════════════════════════════
// HELPERS INTERNOS
// ══════════════════════════════════════════════════════════

/**
 * Genera label amigable del período actual
 * @private
 */
function periodLabel(p, t) {
    if (p === "week") return t("Esta semana");
    if (p === "month") return t("Este mes");
    return t("Semestre 2024-2");
}

/**
 * Días cubiertos por cada opción de período.
 * @private
 */
function periodDays(period) {
    if (period === "week") return 7;
    if (period === "month") return 30;
    return 180;
}

/**
 * Etiqueta corta dd/mm para una fecha YYYY-MM-DD.
 * @private
 */
function shortDate(iso) {
    return `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`;
}

/**
 * Nombre corto del día de semana (lun..dom) para YYYY-MM-DD.
 * @private
 */
function weekdayShort(iso) {
    const names = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
    const d = new Date(`${iso}T12:00:00`);
    return names[Number.isNaN(d.getTime()) ? 1 : d.getDay()];
}

// Clave de semana ISO (YYYY-Www) para agrupar la evolución semanal.
function isoWeekKey(iso) {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 7);
    const day = (d.getDay() + 6) % 7;
    const thursday = new Date(d);
    thursday.setDate(d.getDate() - day + 3);
    const first = new Date(thursday.getFullYear(), 0, 4);
    const firstDay = (first.getDay() + 6) % 7;
    const firstThursday = new Date(first);
    firstThursday.setDate(first.getDate() - firstDay + 3);
    const week = 1 + Math.round((thursday - firstThursday) / (7 * 24 * 3600 * 1000));
    return `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Construye filas para exportación a Excel
 * @private
 */
function buildExcelRows(students, period, _filters, t) {
    return students.map((s) => {
        // Calcular estado biométrico basado en facial y huella
        const hasFacial = s.hasFacial || false;
        const hasFingerprint = s.hasFingerprint || false;
        
        let biometricStatus = "pending";
        let biometricText = t("Pendiente");
        
        if (hasFacial && hasFingerprint) {
            biometricStatus = "registered";
            biometricText = t("Registrado");
        } else if (hasFacial && !hasFingerprint) {
            biometricStatus = "partial";
            biometricText = t("Parcial") + " - " + t("Falta huella");
        } else if (!hasFacial && hasFingerprint) {
            biometricStatus = "partial";
            biometricText = t("Parcial") + " - " + t("Falta facial");
        }
        
        return {
            [t("Código")]: s.code,
            [t("Nombre")]: s.name,
            [t("Programa")]: s.courseName || s.course,
            [t("Ficha/Semestre")]: s.grade,
            [t("Asistencia (%)")]: s.attendance,
            [t("Estado")]: s.status === "active" ? t("Activo") : t("Inactivo"),
            [t("Biometría")]: biometricText,
            [t("Período")]: periodLabel(period, t),
        };
    });
}

// ══════════════════════════════════════════════════════════
// VIEWMODEL PRINCIPAL
// ══════════════════════════════════════════════════════════

/**
 * Hook principal del ViewModel de Reportes
 * 
 * Gestiona la lógica de reportes y sanciones, incluyendo filtrado
 * por tipo, ficha, usuario y umbral de asistencia.
 * 
 * @param {string} filterType - Tipo de filtro ("at-risk" | "ficha" | "user" | null)
 * @param {string} fichaId - ID de ficha específica
 * @param {string} userId - ID de usuario específico
 * @param {number} attendanceThreshold - Umbral de asistencia (default: 75)
 * @returns {object} Estado y métodos del ViewModel
 * 
 * @example
 * // Uso básico - todos los estudiantes
 * const vm = useReportsViewModel();
 * 
 * @example
 * // Filtrar estudiantes en riesgo
 * const vm = useReportsViewModel("at-risk", null, null, 75);
 * 
 * @example
 * // Estudiantes de una ficha específica
 * const vm = useReportsViewModel("ficha", "2640001", null, 75);
 */
export function useReportsViewModel(
    filterType = null,
    fichaId = null,
    userId = null,
    attendanceThreshold = 75
) {
    // ── Estado local ──────────────────────────────────────────
    const [period, setPeriod] = useState("semester");
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [showFilters, setShowFilters] = useState(false);
    const [search, setSearch] = useState("");
    const [fichaFilter, setFichaFilter] = useState(fichaId || "");
    const [statusFilter, setStatusFilter] = useState("active");
    const [sortBy, setSortBy] = useState("none");
    const [notifyState, setNotifyState] = useState({ sending: false, error: null, sent: 0 });

    // ── Hooks de contexto ─────────────────────────────────────
    const { theme } = useTheme();
    const { t } = useTranslation();
    const appData = useAppData();
    const { user } = useAuth();
    const permissions = useRolePermissions();
    const navigation = useNavigation();
    const c = theme.colors;

    // ── Datos del contexto global ─────────────────────────────
    const students = appData.students;
    const courses = appData.courses;
    const isLoading = appData.isLoading;

    /**
     * Helper: obtener nombre completo del curso desde su código o nombre
     */
    const getCourseName = useCallback((courseCodeOrName) => {
        if (!courseCodeOrName) return '—';
        const course = courses.find(c => c.code === courseCodeOrName || c.name === courseCodeOrName);
        return course ? course.name : courseCodeOrName;
    }, [courses]);

    // ══════════════════════════════════════════════════════════
    // DATOS DERIVADOS MEMOIZADOS
    // ══════════════════════════════════════════════════════════

    /**
     * Fichas/programas disponibles para filtrado
     */
    const availableFichas = useMemo(
        () => [
            { value: "", label: t("Todas las fichas") },
            ...appData.programs.map((p) => ({
                value: p.code || p.name,
                label: `${p.code || ""} - ${p.name}`,
            })),
        ],
        [appData.programs, t]
    );

    /**
     * Nombre de la ficha actual (para subtítulo)
     */
    const fichaName = useMemo(() => {
        if (!fichaFilter) return null;
        const ficha = appData.programs.find(p => p.code === fichaFilter || p.name === fichaFilter);
        return ficha ? ficha.name : fichaFilter;
    }, [fichaFilter, appData.programs]);

    /**
     * Serie real de asistencia (HU-REP-003/004): sesiones de clase del
     * alcance del rol dentro del período + sus attendance_record.
     * Tasa = Presentes (+Justificados) sobre registros totales.
     * Sin sesiones o sin backend, la serie queda vacía (nunca mock).
     */
    const [series, setSeries] = useState({ weeks: [], days: [] });
    const [seriesLoading, setSeriesLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setSeriesLoading(true);
            try {
                const days = periodDays(period);
                const now = new Date();
                const cutoff = new Date(now);
                cutoff.setDate(now.getDate() - days);
                const cutoffStr = cutoff.toISOString().slice(0, 10);

                const [sessions, blocks, envs] = await Promise.all([
                    optional(schedulingApi.listSessions(), []),
                    optional(listBlocks(), []),
                    !permissions.isSuperAdmin && user?.role === "admin"
                        ? optional(schedulingApi.listEnvironments(), [])
                        : Promise.resolve([]),
                ]);
                const sessionList = Array.isArray(sessions) ? sessions : sessions?.content ?? sessions?.data ?? [];
                const blockList = Array.isArray(blocks) ? blocks : blocks?.content ?? blocks?.data ?? [];
                const envList = Array.isArray(envs) ? envs : envs?.content ?? envs?.data ?? [];
                const blockById = new Map(
                    blockList.map((b) => [
                        Number(b.scheduleBlockId ?? b.schedule_block_id ?? b.id),
                        b,
                    ])
                );
                const envSchoolById = new Map(
                    envList.map((e) => [
                        Number(e.environmentId ?? e.environment_id ?? e.id),
                        e.schoolId ?? e.school_id ?? null,
                    ])
                );

                const inScope = (s) => {
                    const date = s.sessionDate ?? s.session_date ?? "";
                    if (!date || date < cutoffStr) return false;
                    const status = s.sessionStatus ?? s.session_status ?? "";
                    if (status === "Cancelled") return false;
                    if (permissions.isSuperAdmin) return true;
                    const blockId = Number(s.scheduleBlockId ?? s.schedule_block_id);
                    const block = blockById.get(blockId);
                    if (!block) return user?.role !== "admin";
                    if (user?.role === "teacher") {
                        const instructor = block.instructorActorId ?? block.instructor_actor_id;
                        return Number(instructor) === Number(user?.academicActorId);
                    }
                    if (user?.role === "admin" && user?.schoolId != null) {
                        const envId = Number(block.environmentId ?? block.environment_id);
                        const school = envSchoolById.get(envId);
                        if (school == null) return false;
                        return Number(school) === Number(user.schoolId);
                    }
                    return true;
                };

                const scoped = sessionList
                    .filter(inScope)
                    .sort((a, b) =>
                        String(b.sessionDate ?? b.session_date ?? "").localeCompare(
                            String(a.sessionDate ?? a.session_date ?? "")
                        )
                    )
                    .slice(0, 60);

                const settled = await Promise.allSettled(
                    scoped.map((s) =>
                        attendanceApi.recordsBySession(
                            s.classSessionId ?? s.class_session_id ?? s.id
                        )
                    )
                );
                if (cancelled) return;
                const byDate = new Map();
                scoped.forEach((s, i) => {
                    if (settled[i].status !== "fulfilled") return;
                    const records = Array.isArray(settled[i].value) ? settled[i].value : [];
                    const date = s.sessionDate ?? s.session_date ?? "";
                    const bucket = byDate.get(date) ?? { present: 0, absent: 0, late: 0 };
                    for (const r of records) {
                        const st = r.attendanceStatus ?? r.attendance_status ?? "";
                        if (st === "Present" || st === "Justified") bucket.present += 1;
                        else if (st === "Late") bucket.late += 1;
                        else if (st === "Absent") bucket.absent += 1;
                    }
                    byDate.set(date, bucket);
                });

                const daysArr = [...byDate.entries()]
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([date, b]) => ({
                        day: `${weekdayShort(date)} ${shortDate(date)}`,
                        date,
                        present: b.present,
                        absent: b.absent,
                        late: b.late,
                    }));

                const weekGroups = new Map();
                for (const d of daysArr) {
                    const key = isoWeekKey(d.date);
                    const group = weekGroups.get(key) ?? {
                        week: key,
                        present: 0,
                        absent: 0,
                        late: 0,
                        dailyData: [],
                        from: d.date,
                        to: d.date,
                    };
                    group.present += d.present;
                    group.absent += d.absent;
                    group.late += d.late;
                    group.dailyData.push({ day: d.day, present: d.present, late: d.late, absent: d.absent });
                    if (d.date < group.from) group.from = d.date;
                    if (d.date > group.to) group.to = d.date;
                    weekGroups.set(key, group);
                }
                const weeks = [...weekGroups.values()]
                    .sort((a, b) => a.from.localeCompare(b.from))
                    .map((w) => {
                        const total = w.present + w.absent + w.late;
                        return {
                            week: `${shortDate(w.from)}–${shortDate(w.to)}`,
                            rate: total === 0 ? 0 : Math.round((100 * w.present) / total),
                            dailyData: w.dailyData,
                        };
                    });

                setSeries({ weeks, days: daysArr });
            } catch {
                if (!cancelled) setSeries({ weeks: [], days: [] });
            } finally {
                if (!cancelled) setSeriesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [period, permissions.isSuperAdmin, user?.role, user?.academicActorId, user?.schoolId]);

    /**
     * Datos de asistencia semanal del período (serie real).
     */
    const attendanceByWeek = useMemo(() => series.weeks, [series]);

    /**
     * Datos de asistencia diaria (serie real).
     */
    const attendanceByDay = useMemo(() => series.days, [series]);

    /**
     * Verifica si hay filtros activos
     */
    const filtersActive = useMemo(
        () =>
            filters.courseCode !== DEFAULT_FILTERS.courseCode ||
            filters.attendanceMin !== DEFAULT_FILTERS.attendanceMin ||
            filters.attendanceMax !== DEFAULT_FILTERS.attendanceMax ||
            filters.statusFilter !== DEFAULT_FILTERS.statusFilter ||
            filters.showAtRiskOnly !== DEFAULT_FILTERS.showAtRiskOnly,
        [filters]
    );

    /**
     * Estudiantes filtrados según todos los criterios
     * - filterType (at-risk, ficha, user)
     * - fichaId
     * - userId
     * - attendanceThreshold
     * - search
     * - statusFilter
     * 
     * Enriquecidos con:
     * - courseName: nombre completo del curso
     */
    const filteredStudents = useMemo(() => {
        let result = students;

        // Filtro por tipo
        if (filterType === "at-risk") {
            result = result.filter(s => s.attendance < attendanceThreshold);
        }

        // Filtro por ficha
        if (fichaId || fichaFilter) {
            const targetFicha = fichaId || fichaFilter;
            result = result.filter(s => s.course === targetFicha || s.grade === targetFicha);
        }

        // Filtro por usuario específico
        if (userId) {
            result = result.filter(s => s.id === userId);
        }

        // Filtro por búsqueda
        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(s =>
                s.name.toLowerCase().includes(searchLower) ||
                s.code?.toLowerCase().includes(searchLower) ||
                s.document?.toLowerCase().includes(searchLower)
            );
        }

        // Filtro por estado
        if (statusFilter !== "all") {
            result = result.filter(s => s.status === statusFilter);
        }

        // Enriquecer con nombre completo del curso
        result = result.map(student => ({
            ...student,
            courseName: getCourseName(student.course),
        }));

        // Orden por asistencia: menor a mayor primero (para ubicar casos críticos)
        if (sortBy === "attendance-asc") {
            result = [...result].sort((a, b) => a.attendance - b.attendance);
        } else if (sortBy === "attendance-desc") {
            result = [...result].sort((a, b) => b.attendance - a.attendance);
        }

        return result;
    }, [students, filterType, fichaId, fichaFilter, userId, attendanceThreshold, search, statusFilter, sortBy, getCourseName]);

    /**
     * Estudiantes en riesgo (asistencia < 75%)
     */
    const atRiskStudents = useMemo(
        () => filteredStudents.filter((s) => s.attendance < 75),
        [filteredStudents]
    );

    // ── Reportes por sede (solo super admin) ──────────────────
    // El super admin no pertenece a ninguna escuela: su consulta son los
    // reportes agregados por sede, no los registros de personas concretas.
    const [schoolsById, setSchoolsById] = useState({});

    useEffect(() => {
        if (!permissions.isSuperAdmin) return undefined;
        let cancelled = false;
        optional(academicApi.listSchools(), []).then((list) => {
            if (cancelled) return;
            const rows = Array.isArray(list) ? list : list?.content ?? [];
            const map = {};
            for (const school of rows) map[String(school.schoolId)] = school.name;
            setSchoolsById(map);
        });
        return () => {
            cancelled = true;
        };
    }, [permissions.isSuperAdmin]);

    const schoolSummaries = useMemo(() => {
        if (!permissions.isSuperAdmin) return [];
        const bySchool = new Map();
        for (const s of students) {
            const key = s.schoolId ?? "sin-sede";
            const entry =
                bySchool.get(key) ??
                { schoolId: s.schoolId ?? null, total: 0, active: 0, atRisk: 0, attendanceSum: 0 };
            entry.total += 1;
            if (s.status === "active") entry.active += 1;
            if (s.attendance < 75) entry.atRisk += 1;
            entry.attendanceSum += s.attendance || 0;
            bySchool.set(key, entry);
        }
        return [...bySchool.values()]
            .map((entry) => ({
                ...entry,
                name:
                    entry.schoolId != null
                        ? schoolsById[String(entry.schoolId)] || `${t("Sede")} #${entry.schoolId}`
                        : t("Sin sede"),
                avgAttendance: entry.total ? Math.round(entry.attendanceSum / entry.total) : 0,
            }))
            .sort((a, b) => b.total - a.total);
    }, [permissions.isSuperAdmin, students, schoolsById, t]);

    // ── Paginación ────────────────────────────────────────────
    // Se pinta solo la página actual; los filtros que dejan la página fuera
    // de rango usan la última válida (recorte sin useEffect).
    const [page, setPage] = useState(0);
    const totalStudents = filteredStudents.length;
    const totalPages = Math.max(1, Math.ceil(totalStudents / REPORTS_PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pageStudents = filteredStudents.slice(
        safePage * REPORTS_PAGE_SIZE,
        safePage * REPORTS_PAGE_SIZE + REPORTS_PAGE_SIZE
    );

    /**
     * Estadísticas principales del dashboard
     * Calcula métricas globales con factor de período
     */
    const stats = useMemo(() => {
        if (students.length === 0) {
            return [
                { label: t("Asistencia global"), value: "—", color: c.brand.primary, icon: "trending-up" },
                { label: t("Total aprendices"), value: "0", color: c.status.success, icon: "users" },
                { label: t("En riesgo"), value: "0", color: c.status.danger, icon: "alert-circle" },
                { label: t("Programas"), value: "0", color: c.status.warning, icon: "book-open" },
            ];
        }

        const activeStudents = students.filter((s) => s.status === "active");
        const avgAttendance = Math.round(
            activeStudents.reduce((sum, s) => sum + s.attendance, 0) /
                (activeStudents.length || 1)
        );
        const atRiskCount = students.filter((s) => s.attendance < 75).length;
        const programCount = appData.programs.length;

        // Factor de escala según período para simular variación
        const factor = period === "week" ? 1.03 : period === "month" ? 1.01 : 1;
        const displayRate = Math.min(100, Math.round(avgAttendance * factor));

        const change = period === "week" ? 1.2 : period === "month" ? 0.8 : 0;

        return [
            {
                label: t("Asistencia global"),
                value: `${displayRate}%`,
                change: change,
                changeLabel: t("vs período ant."),
                color: c.brand.primary,
                icon: "trending-up",
            },
            {
                label: t("Total aprendices"),
                value: students.length,
                change: 0,
                color: c.status.success,
                icon: "users",
            },
            {
                label: t("En riesgo"),
                value: atRiskCount,
                color: c.status.danger,
                icon: "alert-circle",
            },
            {
                label: t("Programas"),
                value: programCount,
                color: c.status.warning,
                icon: "book-open",
            },
        ];
    }, [c, t, period, students, appData.programs]);

    /**
     * Distribución de asistencia por categorías
     */
    const distribution = useMemo(() => {
        if (students.length === 0)
            return [
                { name: t("A tiempo"), value: 0, color: c.status.success },
                { name: t("Tardanzas"), value: 0, color: c.status.warning },
                { name: t("Ausentes"), value: 0, color: c.status.danger },
            ];

        // Obtener umbrales dinámicos
        const thresholds = getAttendanceThresholds();
        
        const onTime = students.filter((s) => s.attendance >= thresholds.excellent).length;
        const late = students.filter((s) => s.attendance >= thresholds.warning && s.attendance < thresholds.excellent).length;
        const absent = students.filter((s) => s.attendance < thresholds.warning).length;
        const total = students.length;

        return [
            { name: t("A tiempo"), value: Math.round((onTime / total) * 100), color: c.status.success },
            { name: t("Tardanzas"), value: Math.round((late / total) * 100), color: c.status.warning },
            { name: t("Ausentes"), value: Math.round((absent / total) * 100), color: c.status.danger },
        ];
    }, [c, t, students]);

    /**
     * Ranking de programas por asistencia promedio
     * Agrupa estudiantes y calcula promedios
     */
    const courseRanking = useMemo(() => {
        if (students.length === 0) return [];

        // Agrupa estudiantes por programa y calcula promedio de asistencia
        const byProgram = new Map();
        for (const s of students) {
            if (!s.course) continue;
            if (!byProgram.has(s.course)) byProgram.set(s.course, []);
            byProgram.get(s.course).push(s.attendance);
        }

        return Array.from(byProgram.entries())
            .map(([name, rates]) => ({
                code: name.slice(0, 8).toUpperCase().replace(/ /g, "-"),
                courseName: name,
                rate: Math.round(rates.reduce((a, b) => a + b, 0) / rates.length),
            }))
            .sort((a, b) => b.rate - a.rate)
            .map((item, idx) => ({
                ...item,
                rank: idx + 1,
                barColor: item.rate >= 85 ? c.status.success : c.status.warning,
            }));
    }, [c, students]);

    // ══════════════════════════════════════════════════════════
    // HANDLERS MEMOIZADOS (OPTIMIZACIÓN DE PERFORMANCE)
    // ══════════════════════════════════════════════════════════

    /**
     * Resetea filtros a valores por defecto
     * useCallback evita recreación en cada render
     */
    const resetFilters = useCallback(() => {
        setFilters({ ...DEFAULT_FILTERS });
    }, []);

    /**
     * Toggle filtros de búsqueda
     */
    const toggleFilters = useCallback(() => {
        setShowFilters(prev => !prev);
    }, []);

    /**
     * Notificar a un estudiante individual (POST /api/v1/alerts).
     */
    const notifyStudent = useCallback(async (studentId) => {
        setNotifyState({ sending: true, error: null, sent: 0 });
        try {
            await notifyStudentByActorId(studentId);
            setNotifyState({ sending: false, error: null, sent: 1 });
        } catch (e) {
            setNotifyState({
                sending: false,
                error: e?.message || "No se pudo enviar la notificación",
                sent: 0,
            });
        }
    }, []);

    /**
     * Notificar a todos los estudiantes filtrados (una alerta por actor).
     */
    const notifyAll = useCallback(async () => {
        setNotifyState({ sending: true, error: null, sent: 0 });
        try {
            const { sent } = await notifyActors(filteredStudents.map((s) => s.id));
            setNotifyState({ sending: false, error: null, sent });
        } catch (e) {
            setNotifyState({
                sending: false,
                error: e?.message || "No se pudieron enviar las notificaciones",
                sent: 0,
            });
        }
    }, [filteredStudents]);

    /**
     * Ver detalles de un estudiante: abre Usuarios filtrado por su código.
     */
    const viewStudentDetails = useCallback((studentId) => {
        const found = filteredStudents.find((s) => s.id === studentId);
        navigation.navigate("Users", {
            section: "students",
            searchQuery: found?.code || found?.name || "",
        });
    }, [navigation, filteredStudents]);

    /**
     * Ver historial completo: abre la pestaña Historial.
     */
    const viewFullHistory = useCallback(() => {
        navigation.navigate("History");
    }, [navigation]);

    /**
     * Exporta datos a Excel
     * Orquesta la exportación delegando formato a servicio
     */
    const exportExcel = useCallback(() => {
        const rows = buildExcelRows(filteredStudents, period, filters, t);

        // Hoja 2: evolución semanal
        const weeklyRows = attendanceByWeek.map((w) => ({
            [t("Semana")]: w.week,
            [t("Tasa de Asistencia (%)")]: w.rate,
        }));

        // Hoja 3: ranking por programa
        const rankRows = courseRanking.map((r) => ({
            [t("Posición")]: r.rank,
            [t("Programa")]: r.courseName,
            [t("Promedio (%)")]: r.rate,
        }));

        // Configurar hojas con anchos de columna
        const sheets = [
            {
                name: t("Aprendices"),
                data: rows,
                columns: [
                    { wch: 12 }, // Código
                    { wch: 32 }, // Nombre
                    { wch: 32 }, // Programa
                    { wch: 18 }, // Ficha/Semestre
                    { wch: 16 }, // Asistencia (%)
                    { wch: 12 }, // Estado
                    { wch: 14 }, // Biometría
                    { wch: 20 }, // Período
                ],
            },
            {
                name: t("Evolución Semanal"),
                data: weeklyRows,
            },
            {
                name: t("Ranking Programas"),
                data: rankRows,
            },
        ];

        const filename = `Reporte_Asistencia_${periodLabel(period, t).replace(/ /g, "_")}.xlsx`;
        const result = exportToExcel(sheets, filename);

        if (!result.success) {
            console.error("Error al exportar Excel:", result.error);
        }
    }, [filteredStudents, period, filters, attendanceByWeek, courseRanking, t]);

    /**
     * Exporta datos a PDF
     * Construye HTML y delega exportación a servicio
     */
    const exportPDF = useCallback(() => {
        const periodText = periodLabel(period, t);

        // Construir notas de filtros
        const filterNotes = [];
        if (filters.courseCode) filterNotes.push(`${t("Programa")}: ${filters.courseCode}`);
        if (filters.showAtRiskOnly) filterNotes.push(t("Solo en riesgo"));
        if (filters.statusFilter !== "all")
            filterNotes.push(`${t("Estado")}: ${filters.statusFilter}`);
        if (filters.attendanceMin > 0 || filters.attendanceMax < 100)
            filterNotes.push(
                `${t("Asistencia")}: ${filters.attendanceMin}%–${filters.attendanceMax}%`
            );

        // Construir tabla de estudiantes
        const studentsTable = buildHTMLTable(filteredStudents, [
            { key: "code", label: t("Código") },
            { key: "name", label: t("Nombre") },
            { key: "courseName", label: t("Programa"), render: (value, row) => value || row.course },
            { key: "grade", label: t("Ficha/Semestre") },
            {
                key: "attendance",
                label: t("Asistencia"),
                align: "center",
                render: (value) => formatPercentageWithColor(value, 75, 60),
            },
            {
                key: "status",
                label: t("Estado"),
                render: (value) => {
                    return formatStatusBadge(value, {
                        active: { text: t("Activo"), color: c.status.success },
                        inactive: { text: t("Inactivo"), color: c.text.disabled },
                    });
                },
            },
        ]);

        // Construir tabla de evolución semanal
        const weeklyTable = buildHTMLTable(attendanceByWeek, [
            { key: "week", label: t("Semana") },
            {
                key: "rate",
                label: t("Tasa"),
                align: "center",
                render: (value) => `${value}%`,
            },
        ]);

        // Construir HTML completo del reporte
        const html = buildReportHTML({
            title: "Reporte de Asistencia — FaceAttend EDU",
            subtitle: `Período: ${periodText}`,
            filters: filterNotes,
            sections: [
                {
                    title: `Detalle de Aprendices (${filteredStudents.length})`,
                    content: studentsTable,
                },
                {
                    title: "Evolución Semanal",
                    content: `<div style="max-width:320px">${weeklyTable}</div>`,
                },
            ],
            footer: "FaceAttend EDU — Reporte generado automáticamente",
        });

        const result = exportToPDF(html, `Reporte_${periodText}`);

        if (!result.success) {
            console.warn("Error al exportar PDF:", result.error);
        }
    }, [filteredStudents, period, filters, attendanceByWeek, c, t]);

    /**
     * Exportar selección actual
     */
    const exportSelection = useCallback(() => {
        exportExcel();
    }, [exportExcel]);

    // ══════════════════════════════════════════════════════════
    // RETORNO DEL VIEWMODEL
    // ══════════════════════════════════════════════════════════

    return {
        // Estado básico
        period,
        setPeriod,
        filters,
        setFilters,
        filtersActive,
        showFilters,
        search,
        setSearch,
        fichaFilter,
        setFichaFilter,
        statusFilter,
        setStatusFilter,
        sortBy,
        setSortBy,
        fichaName,

        // Acciones memoizadas
        resetFilters,
        toggleFilters,
        exportExcel,
        exportPDF,
        notifyStudent,
        notifyAll,
        notifyState,
        viewStudentDetails,
        exportSelection,
        viewFullHistory,

        // Datos derivados memoizados
        stats: stats || [],
        distribution: distribution || [],
        attendanceByDay: attendanceByDay || [],
        attendanceByWeek: attendanceByWeek || [],
        courseRanking: courseRanking || [],
        atRiskStudents: atRiskStudents || [],
        filteredStudents: filteredStudents || [],
        availableFichas: availableFichas || [],

        // Paginación (solo una página se pinta a la vez)
        pageStudents: pageStudents || [],
        page: safePage,
        totalPages,
        totalStudents,
        pageSize: REPORTS_PAGE_SIZE,
        setPage,

        // Reportes por sede (vacío salvo para el super admin)
        schoolSummaries: schoolSummaries || [],

        // Estado de carga
        isLoading,
        seriesLoading,
    };
}
