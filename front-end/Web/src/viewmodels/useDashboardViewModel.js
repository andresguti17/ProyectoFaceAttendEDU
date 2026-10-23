import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../view/components/hooks/useTheme";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { useDateFormat } from "../view/components/hooks/useDateFormat";
import { dashboardSeries, instructorClassCounts, recentActivity } from "../services/api/dashboardSeries";
import {
    getAtRiskStudents,
    getPerfectAttendanceStudents,
    getInstructorAttendance,
    getAttendanceThresholds,
} from "../models/data/userDerivedData";
import { getInstitutionConfig } from "../core/config/institutionConfig";

/**
 * Formatear números enteros con separadores de miles
 * @param {number} value - Valor a formatear
 * @returns {string} - Número formateado
 */
function formatNumber(value) {
    if (typeof value !== 'number' || isNaN(value)) return "0";
    return Math.round(value).toLocaleString();
}

/**
 * Formatear porcentajes con redondeo matemáticamente correcto
 * Aplica banker's rounding: si el decimal es exactamente 0.5, redondea hacia el número par más cercano
 * @param {number} value - Valor a formatear
 * @param {number} decimals - Número de decimales (máximo 2)
 * @returns {string} - Porcentaje formateado
 */
function formatPercentage(value, decimals = 1) {
    if (typeof value !== 'number' || isNaN(value)) return "0.0";
    
    const maxDecimals = Math.min(Math.max(decimals, 0), 2);
    
    // Manejar casos extremos
    if (value === 0) return "0.0";
    if (value < 0) return "0.0";
    if (value > 100) return "100.0";
    
    // Banker's rounding implementation más robusta
    const multiplier = Math.pow(10, maxDecimals);
    const scaled = value * multiplier;
    const floor = Math.floor(scaled);
    const remainder = scaled - floor;
    
    let rounded;
    if (Math.abs(remainder - 0.5) < Number.EPSILON) {
        // Exactamente 0.5: redondear hacia el número par
        rounded = (floor % 2 === 0) ? floor : floor + 1;
    } else {
        // Redondeo normal
        rounded = Math.round(scaled);
    }
    
    const result = rounded / multiplier;
    return result.toFixed(maxDecimals);
}

/**
 * ViewModel del Dashboard con datos específicos por rol
 * 
 * ADMIN: Vista completa del sistema
 * - Asistencia de instructores
 * - Ranking de fichas (top y bottom)
 * - Estudiantes en riesgo y destacados
 * - Métricas globales del sistema
 * 
 * TEACHER: Vista de sus cursos
 * - Sus cursos asignados
 * - Estudiantes de sus cursos
 * - Asistencia de sus clases
 * 
 * STUDENT: Vista personal
 * - Su asistencia personal
 * - Sus cursos
 * - Su progreso
 */
export function useDashboardViewModel() {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const { user } = useAuth();
    const { fichas, students, teachers, courses, isLoading } = useAppData();
    const { formatDate } = useDateFormat();
    const c = theme.colors;

    const userRole = user?.role || "student";
    
    // Obtener configuración institucional para dependencias reactivas
    const institutionConfig = getInstitutionConfig();

    // Registro propio del estudiante (para acotar sus series y tarjetas).
    const ownStudent = useMemo(
        () =>
            (students || []).find((s) => s.personId && s.personId === user?.personId) || null,
        [students, user]
    );

    // Series del backend (sesiones + registros reales). Sin datos, las
    // gráficas pintan su estado vacío: nunca se inventan cifras.
    const [series, setSeries] = useState({
        daily: [],
        weekly: [],
        meta: { sessionsToday: 0, sessionsClosedToday: 0 },
    });
    const [activity, setActivity] = useState([]);
    // Clases dictadas/programadas por instructor (solo lo usa el administrador).
    const [classCounts, setClassCounts] = useState(new Map());
    useEffect(() => {
        if (userRole !== "admin") return undefined;
        let cancelled = false;
        instructorClassCounts().then(
            (counts) => {
                if (!cancelled) setClassCounts(counts);
            },
            () => {
                if (!cancelled) setClassCounts(new Map());
            }
        );
        return () => {
            cancelled = true;
        };
    }, [userRole]);

    useEffect(() => {
        let cancelled = false;
        const instructorActorId =
            userRole === "teacher" && user?.academicActorId != null
                ? Number(user.academicActorId)
                : null;
        const ownActorId = Number(ownStudent?.id);
        const academicActorId =
            userRole === "student" && Number.isInteger(ownActorId) ? ownActorId : null;
        dashboardSeries({
            role: userRole,
            instructorActorId,
            academicActorId,
            cohortId: userRole === "student" ? ownStudent?.cohortId ?? null : null,
        }).then(
            (result) => {
                if (!cancelled) setSeries(result);
            },
            () => {
                if (!cancelled) {
                    setSeries({ daily: [], weekly: [], meta: { sessionsToday: 0, sessionsClosedToday: 0 } });
                }
            }
        );
        if (userRole !== "student") {
            recentActivity({ limit: 5 }).then(
                (items) => {
                    if (!cancelled) setActivity(items);
                },
                () => {
                    if (!cancelled) setActivity([]);
                }
            );
        } else {
            setActivity([]);
        }
        return () => {
            cancelled = true;
        };
    }, [userRole, user, ownStudent]);

    const todayLabel = useMemo(() => {
        const d = formatDate(new Date());
        const today = new Date();
        const weekday = today.toLocaleDateString("es-CO", { weekday: "long" });
        const fullLabel = `${weekday}, ${d}`;
        return fullLabel.charAt(0).toUpperCase() + fullLabel.slice(1);
    }, [formatDate]);

    // ── ADMIN: Métricas globales del sistema (detalladas) ─────

    const adminStats = useMemo(() => {
        if (userRole !== "admin") return [];

        // Calcular datos derivados dinámicamente usando funciones centralizadas
        const minAttendanceThreshold = institutionConfig.minAttendance || 80;
        
        const atRiskStudents = getAtRiskStudents(students, minAttendanceThreshold);
        const perfectAttendanceStudents = getPerfectAttendanceStudents(students, minAttendanceThreshold);
        const instructorAttendance = getInstructorAttendance(teachers, classCounts);

        // Validaciones defensivas - verificar que tenemos datos básicos
        if (!instructorAttendance || instructorAttendance.length === 0) return [];
        if (!fichas || fichas.length === 0) return [];
        if (!students || students.length === 0) return [];

        const totalInstructors = instructorAttendance.length;
        
        // Calcular estudiantes REALES por ficha (no usar totalStudents hardcodeado)
        const studentsPerFicha = {};
        const activeStudentsPerFicha = {};
        
        // Contar estudiantes reales que pertenecen a cada ficha
        if (students && students.length > 0) {
            students.forEach(student => {
                const fichaCode = student.course || student.ficha; // Código de la ficha/curso
                if (fichaCode) {
                    // Contar total de estudiantes
                    studentsPerFicha[fichaCode] = (studentsPerFicha[fichaCode] || 0) + 1;
                    
                    // Contar estudiantes activos
                    if (student.status === "active") {
                        activeStudentsPerFicha[fichaCode] = (activeStudentsPerFicha[fichaCode] || 0) + 1;
                    }
                }
            });
        }
        
        const totalFichas = Object.keys(studentsPerFicha).length; // Solo fichas que tienen estudiantes reales
        
        // Calcular totales reales
        const totalStudents = Object.values(studentsPerFicha).reduce((sum, count) => sum + count, 0);
        const activeStudents = Object.values(activeStudentsPerFicha).reduce((sum, count) => sum + count, 0);
        
        const atRiskCount = atRiskStudents?.length || 0;
        const perfectCount = perfectAttendanceStudents?.length || 0;

        // Calcular asistencia promedio REAL por ficha basándose en estudiantes reales
        const realFichaAttendance = {};
        
        if (fichas && fichas.length > 0 && students && students.length > 0) {
            fichas.forEach(ficha => {
                const fichaCode = ficha.code;
                const fichaStudents = students.filter(s => s.course === fichaCode || s.ficha === fichaCode);
                
                if (fichaStudents.length > 0) {
                    // Calcular promedio de asistencia real de los estudiantes de esta ficha
                    const totalAttendance = fichaStudents.reduce((sum, student) => sum + (student.attendance || 0), 0);
                    const avgAttendance = totalAttendance / fichaStudents.length;
                    realFichaAttendance[fichaCode] = avgAttendance;
                }
            });
        }
        
        // Calcular asistencia global con promedios reales
        const attendanceValues = Object.values(realFichaAttendance);
        const globalAvgAttendance = attendanceValues.length > 0 
            ? attendanceValues.reduce((sum, avg) => sum + avg, 0) / attendanceValues.length
            : 0;
        
        // Calcular asistencia del día basándose en estudiantes reales
        let todayAttendanceStats = { present: 0, late: 0, absent: 0 };
        
        if (students && students.length > 0) {
            // Por ahora usamos los datos mock para simular, pero en producción esto vendría de registros reales
            // Se puede calcular basándose en los estudiantes activos y sus patrones de asistencia
            const activeStudentsCount = students.filter(s => s.status === "active").length;
            
            if (activeStudentsCount > 0) {
                // Simular distribución realista basándose en el patrón de asistencia de los estudiantes
                const avgAttendanceRate = students.reduce((sum, s) => sum + (s.attendance || 0), 0) / students.length;
                
                // Calcular distribución proporcional
                const presentRate = avgAttendanceRate / 100;  // % que normalmente asiste
                const lateRate = Math.min(0.08, (100 - avgAttendanceRate) / 300); // ~8% máximo tardanzas
                const absentRate = 1 - presentRate - lateRate;
                
                todayAttendanceStats = {
                    present: Math.round(activeStudentsCount * presentRate),
                    late: Math.round(activeStudentsCount * lateRate),
                    absent: Math.round(activeStudentsCount * absentRate)
                };
            }
        }
        
        const todayTotalStudents = todayAttendanceStats.present + todayAttendanceStats.late + todayAttendanceStats.absent;
        const todayPresent = todayAttendanceStats.present + todayAttendanceStats.late;
        const todayAttendanceRate = todayTotalStudents > 0 
            ? (todayPresent / todayTotalStudents) * 100
            : 0;
        
        // Instructores presentes hoy - calcular basándose en asistencia real
        // Consideramos "presente hoy" a instructores con asistencia >= 85%
        const instructorsToday = instructorAttendance.filter(instructor => 
            (instructor.attendanceRate || 0) >= 85
        ).length;
        
        // Calcular fichas problemáticas y activas basándose en datos reales
        let problematicFichas = 0;
        let activeFichas = 0;
        
        if (fichas && fichas.length > 0) {
            fichas.forEach(ficha => {
                const fichaCode = ficha.code;
                const realAttendance = realFichaAttendance[fichaCode];
                const studentsInFicha = studentsPerFicha[fichaCode] || 0;
                
                if (realAttendance !== undefined && studentsInFicha > 0) {
                    // Ficha activa si tiene estudiantes y asistencia >= 60%
                    if (realAttendance >= 60) {
                        activeFichas++;
                    }
                    
                    // Ficha problemática si asistencia < 75% o pocos estudiantes activos
                    const activeInFicha = activeStudentsPerFicha[fichaCode] || 0;
                    const retentionInFicha = studentsInFicha > 0 ? (activeInFicha / studentsInFicha) : 0;
                    
                    if (realAttendance < 75 || retentionInFicha < 0.8) {
                        problematicFichas++;
                    }
                }
            });
        }
        
        // Tasa de retención (estudiantes activos / total) con formateo correcto
        const retentionRate = totalStudents > 0 
            ? (activeStudents / totalStudents) * 100
            : 0;
        
        // Calcular tasa de puntualidad basándose en estudiantes reales
        // En producción esto vendría de registros de asistencia reales de la semana
        let weeklyPunctualityStats = { totalPresent: 0, totalLate: 0 };
        
        if (students && students.length > 0) {
            const activeStudentsCount = students.filter(s => s.status === "active").length;
            
            if (activeStudentsCount > 0) {
                // Simular datos de puntualidad semanal basándose en patrones de estudiantes
                const daysInWeek = 5;
                const avgAttendanceRate = students.reduce((sum, s) => sum + (s.attendance || 0), 0) / students.length;
                
                // Estudiantes que asisten por día (promedio semanal)
                const avgDailyAttending = Math.round(activeStudentsCount * (avgAttendanceRate / 100));
                
                // De los que asisten, calcular cuántos llegan tarde (basado en puntualidad individual)
                const avgLateRate = 0.08; // ~8% de tardanzas promedio
                const avgDailyLate = Math.round(avgDailyAttending * avgLateRate);
                const avgDailyOnTime = avgDailyAttending - avgDailyLate;
                
                weeklyPunctualityStats = {
                    totalPresent: avgDailyOnTime * daysInWeek,
                    totalLate: avgDailyLate * daysInWeek
                };
            }
        }
        
        const totalAttending = weeklyPunctualityStats.totalPresent + weeklyPunctualityStats.totalLate;
        const punctualityRate = totalAttending > 0 
            ? (weeklyPunctualityStats.totalPresent / totalAttending) * 100
            : 0;

        // Obtener umbrales dinámicos
        const thresholds = getAttendanceThresholds();

        return [
            {
                label: t("Asistencia hoy"),
                value: `${formatPercentage(todayAttendanceRate)}%`,
                subtitle: `${todayPresent}/${todayTotalStudents} ${t("estudiantes")}`,
                change: todayAttendanceRate >= thresholds.excellent ? 2.3 : 
                        todayAttendanceRate >= thresholds.warning ? 1.5 : 
                        todayAttendanceRate >= thresholds.danger ? 0 : -1.5,
                color: todayAttendanceRate >= thresholds.warning ? c.status.success : c.status.warning,
                icon: "calendar",
            },
            {
                label: t("Asistencia global"),
                value: `${formatPercentage(globalAvgAttendance)}%`,
                subtitle: t("Promedio general"),
                change: globalAvgAttendance >= thresholds.warning ? 
                    parseFloat(Math.min(2.5, (globalAvgAttendance - thresholds.warning + 2) * 0.5).toFixed(1)) : 
                    parseFloat(Math.max(-2.5, (globalAvgAttendance - thresholds.warning) * 0.3).toFixed(1)),
                color: globalAvgAttendance >= thresholds.warning ? c.status.success : c.status.warning,
                icon: "trending-up",
            },
            {
                label: t("Total estudiantes"),
                value: formatNumber(totalStudents),
                subtitle: `${formatNumber(activeStudents)} ${t("activos")} (${formatPercentage(retentionRate)}%)`,
                color: c.brand.primary,
                icon: "users",
            },
            {
                label: t("Cursos activos"),
                value: `${activeFichas}/${totalFichas}`,
                subtitle: problematicFichas > 0 ? `${problematicFichas} ${t("requieren atención")}` : t("Todas OK"),
                color: problematicFichas > 0 ? c.status.warning : c.status.success,
                icon: "book-open",
            },
            {
                label: t("Instructores"),
                value: `${instructorsToday}/${totalInstructors}`,
                subtitle: `${t("presentes hoy")}`,
                color: c.brand.primary,
                icon: "briefcase",
            },
            {
                label: t("Estudiantes en riesgo"),
                value: formatNumber(atRiskCount),
                subtitle: t("Requieren intervención"),
                color: c.status.danger,
                icon: "alert-circle",
            },
            {
                label: t("Asistencia perfecta"),
                value: formatNumber(perfectCount),
                subtitle: t("Este mes"),
                color: c.status.success,
                icon: "award",
            },
            {
                label: t("Tasa de puntualidad"),
                value: `${formatPercentage(punctualityRate)}%`,
                subtitle: t("Estudiantes a tiempo"),
                change: punctualityRate >= 95 ? 1.2 :
                        punctualityRate >= 90 ? 0.8 : 
                        punctualityRate >= 85 ? 0.3 : -0.5,
                color: punctualityRate >= 90 ? c.status.success : c.status.warning,
                icon: "clock",
            },
        ];
    }, [c, t, userRole, fichas, students, teachers, series, classCounts]);

    // ── TEACHER: Métricas de sus cursos/fichas asignadas ──────

    const teacherStats = useMemo(() => {
        if (userRole !== "teacher") return [];

        // Calcular datos derivados dinámicamente usando funciones centralizadas
        const minAttendanceThreshold = institutionConfig.minAttendance || 80;
        const thresholds = getAttendanceThresholds();

        const atRiskStudents = getAtRiskStudents(students, minAttendanceThreshold);

        // Validaciones defensivas
        if (!fichas || fichas.length === 0) return [];
        if (!atRiskStudents) return [];

        // Fichas a cargo del docente (por su cuenta de usuario).
        const teacherFichas = (fichas || []).filter(
            (f) => f.instructorId && user?.id && String(f.instructorId) === String(user.id)
        );
        if (teacherFichas.length === 0) return [];
        const totalStudents = teacherFichas.reduce((sum, f) => sum + (f.totalStudents || 0), 0);
        const activeStudents = teacherFichas.reduce((sum, f) => sum + (f.activeStudents || 0), 0);
        const avgAttendance = teacherFichas.reduce((sum, f) => sum + (f.avgAttendance || 0), 0) / (teacherFichas.length || 1);

        // Estudiantes en riesgo de mis fichas
        const myAtRiskStudents = atRiskStudents.filter(s =>
            teacherFichas.some(f => f.code === s.ficha)
        );

        // Asistencia hoy de mis fichas (último día con sesión real).
        const lastDay = series.daily.length > 0 ? series.daily[series.daily.length - 1] : null;
        const lastTotal = lastDay
            ? (lastDay.present || 0) + (lastDay.late || 0) + (lastDay.absent || 0)
            : 0;
        const todayAvg = lastTotal > 0
            ? (((lastDay.present || 0) + (lastDay.late || 0)) / lastTotal) * 100
            : 0;

        // Clases de hoy (sesiones reales de sus bloques).
        const classesToday = series.meta.sessionsToday || 0;
        const completedClasses = series.meta.sessionsClosedToday || 0;

        return [
            {
                label: t("Asistencia hoy"),
                value: `${formatPercentage(todayAvg)}%`,
                subtitle: `${t("En mis fichas")}`,
                color: todayAvg >= 85 ? c.status.success : c.status.warning,
                icon: "calendar",
            },
            {
                label: t("Mis fichas"),
                value: teacherFichas.length,
                subtitle: t("Fichas asignadas"),
                color: c.brand.primary,
                icon: "book-open",
            },
            {
                label: t("Mis estudiantes"),
                value: totalStudents,
                subtitle: `${activeStudents} ${t("activos")}`,
                color: c.status.success,
                icon: "users",
            },
            {
                label: t("Asistencia promedio"),
                value: `${formatPercentage(avgAttendance)}%`,
                subtitle: t("General"),
                change: avgAttendance >= thresholds.excellent ? 2.5 : 
                        avgAttendance >= thresholds.warning ? 1.5 : 
                        avgAttendance >= thresholds.danger ? 0.5 : -1.0,
                color: avgAttendance >= thresholds.warning ? c.status.success : c.status.warning,
                icon: "trending-up",
            },
            {
                label: t("Clases hoy"),
                value: `${completedClasses}/${classesToday}`,
                subtitle: `${classesToday - completedClasses} ${t("pendientes")}`,
                color: c.brand.primary,
                icon: "clock",
            },
            {
                label: t("Estudiantes en riesgo"),
                value: myAtRiskStudents.length,
                subtitle: t("Requieren atención"),
                color: myAtRiskStudents.length > 0 ? c.status.danger : c.status.success,
                icon: "alert-circle",
            },
        ];
    }, [c, t, userRole, user, fichas, students, courses, teachers, series, institutionConfig.minAttendance, institutionConfig.daysUntilSanction, institutionConfig.consecutiveDaysForSanction]);

    // ── STUDENT: Métricas personales del día ──────────────────

    const studentStats = useMemo(() => {
        if (userRole !== "student") return [];

        const thresholds = getAttendanceThresholds();

        // Registro propio (no el primero de la lista).
        const studentData = ownStudent;
        if (!studentData) return [];
        if (!courses || courses.length === 0) return [];

        // Cursos propios por matrícula.
        const ownCourseIds = new Set((studentData.courseIds || []).map(String));
        const ownCourses = (courses || []).filter((course) =>
            ownCourseIds.size === 0
                ? course.code === studentData.course || String(course.id) === String(studentData.courseId)
                : ownCourseIds.has(String(course.id))
        );

        // Estado de hoy desde su serie real (último día con registro).
        const lastDay = series.daily.length > 0 ? series.daily[series.daily.length - 1] : null;
        const todayStatus =
            !lastDay || (lastDay.present === 0 && lastDay.late === 0 && lastDay.absent === 0)
                ? "pending"
                : lastDay.absent > 0 && lastDay.present === 0 && lastDay.late === 0
                    ? "absent"
                    : lastDay.late > 0
                        ? "late"
                        : "present";
        const todayStatusLabel = {
            present: t("Presente"),
            late: t("Tardanza"),
            absent: t("Ausente"),
            pending: t("Pendiente"),
        }[todayStatus] || t("Pendiente");

        const todayStatusColor = {
            present: c.status.success,
            late: c.status.warning,
            absent: c.status.danger,
            pending: c.text.secondary,
        }[todayStatus] || c.text.secondary;

        // Asistencia del mes actual
        const monthAttendance = studentData?.attendance || 0;

        // Clases de hoy de su ficha (sesiones reales) y sus registros.
        const classesToday = series.meta.sessionsToday || 0;
        const attendedToday = lastDay
            ? (lastDay.present || 0) + (lastDay.late || 0) + (lastDay.absent || 0)
            : 0;
        const pendingToday = Math.max(0, classesToday - attendedToday);

        // Clase de hoy según el horario de su ficha; sin clase hoy, el primer curso inscrito.
        const todayClass = series.meta.currentClass || null;
        const fallbackCourse = ownCourses[0] || null;
        const currentClass = todayClass
            ? {
                  code: todayClass.environmentCode || todayClass.courseCode,
                  name: todayClass.environmentName || todayClass.courseName,
                  professor: todayClass.instructorName,
              }
            : fallbackCourse;

        return [
            {
                label: t("Estado hoy"),
                value: todayStatusLabel,
                subtitle: todayLabel,
                color: todayStatusColor,
                icon: todayStatus === "present" ? "check-circle" : 
                      todayStatus === "late" ? "clock" : 
                      todayStatus === "absent" ? "x-circle" : "circle",
            },
            {
                label: t("Mi asistencia"),
                value: `${formatPercentage(monthAttendance)}%`,
                subtitle: t("Este mes"),
                change: monthAttendance >= thresholds.excellent ? 2.4 :
                        monthAttendance >= (thresholds.warning + thresholds.excellent) / 2 ? 1.8 :
                        monthAttendance >= thresholds.warning ? 1.0 :
                        monthAttendance >= thresholds.danger ? 0 : -1.2,
                color: monthAttendance >= (thresholds.warning + thresholds.excellent) / 2 ? c.status.success : 
                       monthAttendance >= thresholds.danger ? c.status.warning : c.status.danger,
                icon: "trending-up",
            },
            {
                label: t("Ambiente actual"),
                value: currentClass?.code || "N/A",
                subtitle: currentClass?.name || t("Sin asignar"),
                color: c.brand.primary,
                icon: "map-pin",
            },
            {
                label: t("Instructor"),
                value: currentClass?.professor?.split(",")[0]?.trim() || t("Sin asignar"),
                subtitle: currentClass?.professor || t("Sin instructor"),
                color: c.brand.primary,
                icon: "user",
            },
            {
                label: t("Clases hoy"),
                value: `${attendedToday}/${classesToday}`,
                subtitle: pendingToday > 0 ? `${pendingToday} ${t("pendientes")}` : t("Completadas"),
                color: pendingToday === 0 ? c.status.success : c.brand.primary,
                icon: "book",
            },
            {
                label: t("Mis cursos"),
                value: ownCourses.length || 0,
                subtitle: t("Inscritos"),
                color: c.status.success,
                icon: "book-open",
            },
        ];
    }, [c, t, userRole, ownStudent, courses, series]);

    // Seleccionar stats según rol
    const stats = useMemo(() => {
        switch (userRole) {
            case "admin":
                return adminStats;
            case "teacher":
                return teacherStats;
            case "student":
                return studentStats;
            default:
                return studentStats;
        }
    }, [userRole, adminStats, teacherStats, studentStats]);

    // ── Asistencia por día (serie real del backend) ───────────

    const attendanceByDay = useMemo(
        () =>
            (series.daily || []).map(({ day, present, late, absent }) => ({
                day,
                present: present || 0,
                late: late || 0,
                absent: absent || 0,
            })),
        [series]
    );

    // ── Asistencia por semana (serie real del backend) ────────

    const attendanceByWeek = useMemo(() => series.weekly || [], [series]);

    // ── Asistencia por curso/ficha (tasas reales por curso) ────

    const courseAttendance = useMemo(() => {
        // Alcance por rol (igual que Mis cursos): el docente solo ve sus
        // cursos (instructorActorIds), el estudiante los suyos. Sin esto el
        // panel mostraba todos los cursos como "Mis fichas asignadas".
        let scoped = courses || [];
        if (userRole === "teacher") {
            // Mismo criterio que Mis cursos: sin academicActorId no hay fichas
            // propias (no se debe listar el curso ajeno).
            const actorId = user?.academicActorId;
            scoped = (courses || []).filter(
                (course) =>
                    Array.isArray(course.instructorActorIds) &&
                    actorId != null &&
                    course.instructorActorIds.includes(actorId)
            );
        } else if (userRole === "student" && ownStudent) {
            const ownCourseIds = new Set((ownStudent.courseIds || []).map(String));
            scoped = (courses || []).filter((course) =>
                ownCourseIds.size === 0
                    ? course.code === ownStudent.course ||
                      String(course.id) === String(ownStudent.courseId)
                    : ownCourseIds.has(String(course.id))
            );
        }
        const source = scoped
            .filter((course) => course && (course.avgAttendance || 0) > 0)
            .slice(0, 8);
        return source.map((course) => {
            const rate = course.avgAttendance || 0;
            const barColor =
                rate >= 85
                    ? c.status.success
                    : rate >= 75
                    ? c.status.warning
                    : c.status.danger;
            return {
                course: course.code,
                courseName: course.name ?? course.code,
                rate,
                barColor,
            };
        });
    }, [c, courses, userRole, user, ownStudent]);

    // ── Datos específicos de ADMIN ────────────────────────────

    const adminData = useMemo(() => {
        if (userRole !== "admin") return null;
        
        // Obtener configuración dinámica
        const minAttendanceThreshold = institutionConfig.minAttendance || 80;
        
        // Calcular datos derivados dinámicamente
        const instructorAttendance = getInstructorAttendance(teachers, classCounts);
        const atRiskStudents = getAtRiskStudents(students, minAttendanceThreshold);
        const perfectAttendanceStudents = getPerfectAttendanceStudents(students, minAttendanceThreshold);
        
        // Validaciones defensivas
        if (!courses || courses.length === 0) return null;
        
        // ═══════════════════════════════════════════════════════════════════
        // CALCULAR FICHAS REALES DINÁMICAMENTE DESDE CURSOS
        // ═══════════════════════════════════════════════════════════════════
        const realCoursesData = courses.map(course => {
            // Obtener estudiantes de este curso
            const courseStudents = students.filter(s => 
                s.course === course.code || s.course === course.name || s.course === course.id
            );
            
            // Calcular métricas del curso
            const totalStudents = courseStudents.length;
            const activeStudents = courseStudents.filter(s => s.status === "active").length;
            const avgAttendance = totalStudents > 0
                ? courseStudents.reduce((sum, s) => sum + (s.attendance || 0), 0) / totalStudents
                : 0;
            const atRiskCount = courseStudents.filter(s => s.attendance < minAttendanceThreshold).length;
            
            // Obtener instructor del curso
            const instructor = teachers.find(t => t.id === course.instructor);
            const instructorName = instructor ? instructor.name : "Sin asignar";
            
            return {
                id: course.id,
                code: course.code,
                name: course.name,
                program: course.name, // El nombre del curso es el programa
                color: course.color || "#3B82F6",
                instructor: instructorName,
                totalStudents,
                activeStudents,
                avgAttendance,
                atRiskStudents: atRiskCount,
            };
        });

        return {
            instructorAttendance: instructorAttendance || [],
            fichas: realCoursesData, // AHORA USA CURSOS REALES
            atRiskStudents: atRiskStudents || [],
            perfectAttendanceStudents: perfectAttendanceStudents || [],
            
            // Top 5 fichas (cursos con mejor asistencia)
            topFichas: [...realCoursesData]
                .sort((a, b) => b.avgAttendance - a.avgAttendance)
                .slice(0, 5),
            
            // Bottom 3 fichas (cursos con peor asistencia)
            bottomFichas: [...realCoursesData]
                .sort((a, b) => a.avgAttendance - b.avgAttendance)
                .slice(0, 3),
        };
    }, [userRole, courses, students, teachers, classCounts, institutionConfig.minAttendance, institutionConfig.daysUntilSanction, institutionConfig.consecutiveDaysForSanction]);

    // ── Datos específicos de TEACHER ──────────────────────────

    const teacherData = useMemo(() => {
        if (userRole !== "teacher") return null;
        
        // Obtener configuración dinámica
        const minAttendanceThreshold = institutionConfig.minAttendance || 80;
        
        // Calcular datos derivados dinámicamente
        const atRiskStudents = getAtRiskStudents(students, minAttendanceThreshold);
        
        // Validaciones defensivas
        if (!courses || courses.length === 0) return null;

        // CALCULAR CURSOS DEL TEACHER DINÁMICAMENTE
        // TODO: Filtrar por user.assignedCourses cuando esté implementado
        const teacherCourses = courses.slice(0, 2).map(course => {
            // Obtener estudiantes de este curso
            const courseStudents = students.filter(s => 
                s.course === course.code || s.course === course.name || s.course === course.id
            );
            
            // Calcular métricas del curso
            const totalStudents = courseStudents.length;
            const activeStudents = courseStudents.filter(s => s.status === "active").length;
            const avgAttendance = totalStudents > 0
                ? courseStudents.reduce((sum, s) => sum + (s.attendance || 0), 0) / totalStudents
                : 0;
            const atRiskCount = courseStudents.filter(s => s.attendance < minAttendanceThreshold).length;
            
            // Obtener instructor del curso
            const instructor = teachers.find(t => t.id === course.instructor);
            const instructorName = instructor ? instructor.name : "Sin asignar";
            
            return {
                id: course.id,
                code: course.code,
                name: course.name,
                program: course.name,
                color: course.color || "#3B82F6",
                instructor: instructorName,
                totalStudents,
                activeStudents,
                avgAttendance,
                atRiskStudents: atRiskCount,
            };
        });
        
        // Estudiantes en riesgo de los cursos del teacher
        const teacherAtRiskStudents = (atRiskStudents || []).filter(s =>
            teacherCourses.some(c => c.code === s.course || c.code === s.ficha)
        );

        return {
            myFichas: teacherCourses,
            myAtRiskStudents: teacherAtRiskStudents,
        };
    }, [userRole, user, fichas, students, courses, teachers, institutionConfig.minAttendance, institutionConfig.daysUntilSanction, institutionConfig.consecutiveDaysForSanction]);

    // ── Datos específicos de STUDENT ──────────────────────────

    const studentData = useMemo(() => {
        if (userRole !== "student") return null;

        // Validaciones defensivas
        if (!ownStudent) return null;
        if (!courses || courses.length === 0) return null;

        const ownCourseIds = new Set((ownStudent.courseIds || []).map(String));
        const ownCourses = (courses || []).filter((course) =>
            ownCourseIds.size === 0
                ? course.code === ownStudent.course || String(course.id) === String(ownStudent.courseId)
                : ownCourseIds.has(String(course.id))
        );

        return {
            personalInfo: ownStudent,
            upcomingClasses: ownCourses.slice(0, 3),
        };
    }, [userRole, ownStudent, courses]);

    return {
        // Datos comunes
        userRole,
        isLoading, // AppDataContext todavía cargando el padrón de la sede
        todayLabel,
        stats: stats || [],
        attendanceByDay: attendanceByDay || [],      // Serie real del backend
        attendanceByWeek: attendanceByWeek || [],    // Serie real del backend
        courseAttendance: courseAttendance || [],    // Tasas reales por curso
        recentActivity: activity || [],              // Actividad real del backend

        // Datos por rol
        adminData: adminData || null,
        teacherData: teacherData || null,
        studentData: studentData || null,
    };
}

