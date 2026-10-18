// ============================================================
//  FaceAttend EDU — Dashboard VIEW (Tab Principal)
// ============================================================
//  RESPONSABILIDAD: Presentación y UI ("cómo se presenta")
//
//  Este componente:
//  ✓ Renderiza el contenido del tab principal del Dashboard
//  ✓ Muestra dashboards diferenciados por rol (Admin/Teacher/Student)
//  ✓ Maneja la presentación visual de datos del dashboard
//  ✓ Coordina hooks de presentación (useDashboardViewModel)
//
//  Dashboard por rol:
//  - ADMIN: Vista completa del sistema (instructores, fichas, estudiantes)
//  - TEACHER: Vista de sus cursos y estudiantes
//  - STUDENT: Vista personal
// ============================================================

import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
    Card,
    StatCard,
    Button,
    ProgressBar,
    AttendanceStatusIcon,
    AttendanceStatusBadge,
    EmptyState,
    Loader,
    PageHeader,
} from "./components/common";
import {
    DailyBarChart,
    WeeklyTrend,
    useWeeklyAttendanceController,
    WeeklyAttendanceView,
    InstructorAttendanceList,
    TopPerformingGroups,
    AtRiskStudentsList,
    PerfectAttendanceList,
} from "./components/dashboard";
import { useTheme }              from "./components/hooks/useTheme";
import { useResponsive }         from "./components/hooks/useResponsive";
import { useDashboardViewModel } from "../viewmodels/useDashboardViewModel";
import { useRolePermissions }    from "../viewmodels/useRolePermissions";
import { useTranslation }        from "../core/utils/i18n/hooks/useTranslation";
import { 
    DEFAULT_ACADEMIC_PERIOD,
    getCurrentPeriod,
    getAcademicPeriodConfig,
    getConfiguredAcademicPeriodType
} from "../core/constants/academicPeriods";
import { onInstitutionConfigChange } from "../core/config/institutionConfig";

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

/**
 * Genera el subtítulo dinámico para la sección de tendencia semanal
 * según el período académico configurado (viene de Settings)
 * 
 * @param {string} periodType - Tipo de período académico
 * @param {Function} t - Función de traducción
 * @returns {string} Subtítulo formateado
 */
function getWeeklyTrendSubtitle(periodType, t) {
    const currentPeriod = getCurrentPeriod(periodType);
    const config = getAcademicPeriodConfig(periodType);
    
    if (!currentPeriod || !config) {
        return `${t("Selecciona para ver detalles")}`;
    }
    
    // Formatear el label del período según el tipo
    let periodLabel;
    switch (periodType) {
        case "annual":
            periodLabel = t("Año actual");
            break;
        case "semestral":
            periodLabel = currentPeriod.periodNumber === 1 
                ? t("Primer semestre") 
                : t("Segundo semestre");
            break;
        case "quarterly":
            periodLabel = `${t("Cuatrimestre")} ${currentPeriod.periodNumber}`;
            break;
        case "trimestral":
            periodLabel = `${t("Trimestre")} ${currentPeriod.periodNumber}`;
            break;
        default:
            periodLabel = currentPeriod.label;
    }
    
    // Agregar indicador si es configuración manual
    const manualIndicator = currentPeriod.isManual ? ` ${t("(Manual)")}` : "";
    
    return `${periodLabel}${manualIndicator} (${t(config.labelKey)}) • ${t("Selecciona para ver detalles")}`;
}

/**
 * Componente reutilizable para headers de sección con "Ver todos" condicional
 * 
 * @param {string} title - Título de la sección
 * @param {string} subtitle - Subtítulo descriptivo
 * @param {number} totalItems - Total de items disponibles
 * @param {number} maxItems - Máximo de items mostrados
 * @param {function} onSeeAll - Callback al presionar "Ver todos"
 * @param {object} colors - Objeto de colores del tema
 * @param {function} t - Función de traducción
 */
function SectionHeader({ title, subtitle, totalItems, maxItems, onSeeAll, colors, t }) {
    const showSeeAll = totalItems > maxItems;
    
    return (
        <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            zIndex: 1000,
        }}>
            <View style={{ flex: 1 }}>
                <Text style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: colors.text.primary,
                }}>
                    {title}
                </Text>
                <Text style={{
                    fontSize: 13,
                    color: colors.text.secondary,
                    marginTop: 2,
                }}>
                    {subtitle}
                </Text>
            </View>
            {showSeeAll && onSeeAll && (
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={onSeeAll}
                >
                    <Text style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: colors.brand.primary,
                    }}>
                        {t("Ver todos →")}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

// ──────────────────────────────────────────────────────────────
// Estado sin datos: antes los paneles hacían `return null` y la
// pantalla de Inicio quedaba vacía en blanco mientras AppDataContext
// cargaba (o si una carga fallaba). Ahora se informa al usuario.
// ──────────────────────────────────────────────────────────────

function PanelDataState({ isLoading, t }) {
    if (isLoading) {
        return <Loader message={t("Cargando información del panel...")} />;
    }
    return (
        <EmptyState
            icon="bar-chart-2"
            title={t("Sin datos por ahora")}
            message={t("Aún no hay información disponible en el panel. Verifica que tu cuenta tenga fichas y cursos asignados.")}
        />
    );
}

// ──────────────────────────────────────────────────────────────
// ADMIN DASHBOARD — Vista completa del sistema
// ──────────────────────────────────────────────────────────────

function AdminDashboard({ vm, permissions, isSmall, c, t, navigation }) {
    // Estado para el período académico (reactivo a cambios en Settings)
    const [academicPeriod, setAcademicPeriod] = useState(() => getConfiguredAcademicPeriodType());
    
    // Escuchar cambios en la configuración institucional
    useEffect(() => {
        const cleanup = onInstitutionConfigChange((newConfig) => {
            if (newConfig.academicPeriodType && newConfig.academicPeriodType !== academicPeriod) {
                setAcademicPeriod(newConfig.academicPeriodType);
            }
        });
        return cleanup;
    }, [academicPeriod]);
    
    // Hook para orquestar selección de semanas - DEBE ejecutarse siempre
    const {
        selectedWeek,
        handleWeekSelect,
        handleResetToCurrentWeek,
        weeklyTrendProps,
        dailyBarChartProps,
        currentWeekNumber,
        isCurrentWeek,
    } = useWeeklyAttendanceController(vm.attendanceByWeek, vm.attendanceByDay);
    
    // Obtener subtítulo con el período académico reactivo
    const weeklySubtitle = getWeeklyTrendSubtitle(academicPeriod, t);
    
    // Early return DESPUÉS de todos los hooks
    if (!vm.adminData) return <PanelDataState isLoading={vm.isLoading} t={t} />;

    // Label dinámico: si es la semana actual mostrar "Esta semana (Sem X)", sino "Sem X"
    const weekLabel = isCurrentWeek && currentWeekNumber
        ? `${t("Esta semana")} (Sem ${currentWeekNumber})` 
        : selectedWeek 
            ? selectedWeek.week 
            : t("Esta semana");

    return (
        <>
            {/* Stats principales */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {vm.stats.map((stat) => (
                    <View key={stat.label} style={{ 
                        flexBasis: isSmall ? "47%" : "23%", 
                        flexGrow: 1,
                        minWidth: 160,
                    }}>
                        <StatCard
                            label={stat.label}
                            value={stat.value}
                            icon={<Feather name={stat.icon} size={20} color={stat.color} />}
                            trend={stat.change ? (stat.change > 0 ? "up" : "down") : undefined}
                            trendValue={stat.change ? `${Math.abs(stat.change)}%` : undefined}
                            color={stat.color}
                        />
                        {stat.subtitle && (
                            <Text style={{
                                fontSize: 12,
                                color: c.text.secondary,
                                marginTop: 4,
                                marginLeft: 16,
                            }}>
                                {stat.subtitle}
                            </Text>
                        )}
                    </View>
                ))}
            </View>

            {/* Sección: Asistencia de Instructores */}
            <View>
                <SectionHeader
                    title={t("Asistencia de Instructores")}
                    subtitle={t("Resumen de asistencia del personal docente")}
                    totalItems={vm.adminData.instructorAttendance?.length || 0}
                    maxItems={5}
                    onSeeAll={() => navigation.navigate("Users", { section: "teachers" })}
                    colors={c}
                    t={t}
                />
                
                <InstructorAttendanceList
                    instructors={vm.adminData.instructorAttendance}
                    maxItems={5}
                    onInstructorPress={(instructor) => {
                        console.log("Ver detalle instructor:", instructor);
                    }}
                />
            </View>

            {/* Sección: Top Fichas */}
            <View style={{ flexDirection: isSmall ? "column" : "row", gap: 16 }}>
                <View style={{ flex: 1 }}>
                    <View style={{ marginBottom: 12 }}>
                        <Text style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: c.text.primary,
                        }}>
                            {t("Mejores Cursos")} 🏆
                        </Text>
                        <Text style={{
                            fontSize: 13,
                            color: c.text.secondary,
                            marginTop: 2,
                        }}>
                            {t("Cursos con mejor asistencia")}
                        </Text>
                    </View>
                    
                    <TopPerformingGroups
                        fichas={vm.adminData.fichas}
                        mode="top"
                        maxItems={5}
                        onFichaPress={(ficha) => {
                            console.log("Ver detalle ficha:", ficha);
                        }}
                    />
                </View>

                <View style={{ flex: 1 }}>
                    <View style={{ marginBottom: 12 }}>
                        <Text style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: c.text.primary,
                        }}>
                            {t("Cursos que Necesitan Atención")} ⚠️
                        </Text>
                        <Text style={{
                            fontSize: 13,
                            color: c.text.secondary,
                            marginTop: 2,
                        }}>
                            {t("Cursos con menor asistencia")}
                        </Text>
                    </View>
                    
                    <TopPerformingGroups
                        fichas={vm.adminData.fichas}
                        mode="bottom"
                        maxItems={3}
                        onFichaPress={(ficha) => {
                            console.log("Ver detalle ficha:", ficha);
                        }}
                    />
                </View>
            </View>

            {/* Gráficas de tendencias - Orquestadas por el hook */}
            <View style={{ flexDirection: isSmall ? "column" : "row", gap: 16 }}>
                <Card style={{ flex: 1 }}>
                    <WeeklyTrend 
                        {...weeklyTrendProps}
                        title={t("Tendencia semanal")}
                        maxWeeks={5}
                        showTrend={true}
                        colorByPerformance={true}
                        academicPeriod={academicPeriod}
                        t={t}
                    />
                </Card>

                <Card style={{ flex: 1 }}>
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 4,
                        minHeight: 20,
                    }}>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: c.text.primary,
                        }}>
                            {t("Asistencia por día")}
                        </Text>
                        {!isCurrentWeek && (
                            <TouchableOpacity
                                onPress={handleResetToCurrentWeek}
                                style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                    backgroundColor: c.status.info + "15",
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={{
                                    fontSize: 10,
                                    fontWeight: "600",
                                    color: c.status.info,
                                }}>
                                    {currentWeekNumber 
                                        ? `${t("Ver semana actual")} (Sem ${currentWeekNumber})`
                                        : t("Ver semana actual")
                                    }
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={{
                        fontSize: 12,
                        color: c.text.secondary,
                        marginBottom: 16,
                        minHeight: 16,
                    }}>
                        {weekLabel}
                    </Text>
                    <DailyBarChart 
                        {...dailyBarChartProps}
                        height={100}
                        showLegend={true}
                        showSummary={true}
                    />
                </Card>
            </View>

            {/* Sección: Estudiantes en Riesgo y Destacados */}
            <View style={{ flexDirection: isSmall ? "column" : "row", gap: 16 }}>
                <View style={{ flex: 1 }}>
                    <SectionHeader
                        title={`${t("Estudiantes en Riesgo")} 🚨`}
                        subtitle={t("Requieren intervención urgente")}
                        totalItems={vm.adminData.atRiskStudents?.length || 0}
                        maxItems={5}
                        onSeeAll={() => navigation.navigate("Users", { 
                            section: "students",
                            attendanceFilter: "lt" // lt = less than (menor que)
                        })}
                        colors={c}
                        t={t}
                    />
                    
                    <AtRiskStudentsList
                        students={vm.adminData.atRiskStudents}
                        maxItems={5}
                        navigation={navigation}
                        onStudentPress={(student) => {
                            console.log("Ver detalle estudiante:", student);
                        }}
                    />
                </View>

                <View style={{ flex: 1 }}>
                    <SectionHeader
                        title={`${t("Estudiantes Destacados")} ⭐`}
                        subtitle={t("Excelencia en asistencia")}
                        totalItems={vm.adminData.perfectAttendanceStudents?.length || 0}
                        maxItems={5}
                        onSeeAll={() => navigation.navigate("Users", { 
                            section: "students",
                            attendanceFilter: "gt" // gt = greater than (mayor que)
                        })}
                        colors={c}
                        t={t}
                    />
                    
                    <PerfectAttendanceList
                        students={vm.adminData.perfectAttendanceStudents}
                        maxItems={5}
                        navigation={navigation}
                        onStudentPress={(student) => {
                            console.log("Ver detalle estudiante:", student);
                        }}
                    />
                </View>
            </View>
        </>
    );
}

// ──────────────────────────────────────────────────────────────
// TEACHER DASHBOARD — Vista de cursos del instructor
// ──────────────────────────────────────────────────────────────

function TeacherDashboard({ vm, permissions, isSmall, c, t, navigation }) {
    // Estado para el período académico (reactivo a cambios en Settings)
    const [academicPeriod, setAcademicPeriod] = useState(() => getConfiguredAcademicPeriodType());
    
    // Escuchar cambios en la configuración institucional
    useEffect(() => {
        const cleanup = onInstitutionConfigChange((newConfig) => {
            if (newConfig.academicPeriodType && newConfig.academicPeriodType !== academicPeriod) {
                setAcademicPeriod(newConfig.academicPeriodType);
            }
        });
        return cleanup;
    }, [academicPeriod]);
    
    if (!vm.teacherData) return <PanelDataState isLoading={vm.isLoading} t={t} />;    
    // Obtener subtítulo con el período académico reactivo
    const weeklySubtitle = getWeeklyTrendSubtitle(academicPeriod, t);

    return (
        <>
            {/* Stats del teacher */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {vm.stats.map((stat) => (
                    <View key={stat.label} style={{ 
                        flexBasis: isSmall ? "47%" : "23%", 
                        flexGrow: 1 
                    }}>
                        <StatCard
                            label={stat.label}
                            value={stat.value}
                            icon={<Feather name={stat.icon} size={20} color={stat.color} />}
                            trend={stat.change ? (stat.change > 0 ? "up" : "down") : undefined}
                            trendValue={stat.change ? `${Math.abs(stat.change)}%` : undefined}
                            color={stat.color}
                        />
                    </View>
                ))}
            </View>

            {/* Mis cursos */}
            <View>
                <Text style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: c.text.primary,
                    marginBottom: 12,
                }}>
                    {t("Mis Cursos")}
                </Text>
                
                <TopPerformingGroups
                    fichas={vm.teacherData.myFichas}
                    mode="top"
                    maxItems={10}
                    onFichaPress={(ficha) => {
                        console.log("Ver detalle ficha:", ficha);
                    }}
                />
            </View>

            {/* Gráficas del teacher */}
            <View style={{ flexDirection: isSmall ? "column" : "row", gap: 16 }}>
                <Card style={{ flex: 1 }}>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: c.text.primary,
                        marginBottom: 4,
                    }}>
                        {t("Asistencia por ficha")}
                    </Text>
                    <Text style={{
                        fontSize: 12,
                        color: c.text.secondary,
                        marginBottom: 16,
                    }}>
                        {t("Mis cursos asignados")}
                    </Text>
                    <View style={{ gap: 14 }}>
                        {vm.courseAttendance.map(item => (
                            <View key={item.course}>
                                <View style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: 8,
                                }}>
                                    <Text style={{
                                        fontSize: 13,
                                        fontWeight: "500",
                                        color: c.text.primary,
                                        flex: 1,
                                    }} numberOfLines={1}>
                                        {item.courseName}
                                    </Text>
                                    <Text style={{
                                        fontSize: 13,
                                        fontWeight: "700",
                                        color: item.barColor,
                                        marginLeft: 8,
                                    }}>
                                        {item.rate}%
                                    </Text>
                                </View>
                                <ProgressBar
                                    value={item.rate}
                                    color={item.barColor}
                                    size="md"
                                />
                            </View>
                        ))}
                    </View>
                </Card>
                
                {/* Vista integrada de tendencia semanal */}
                <Card style={{ flex: 1 }}>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: c.text.primary,
                        marginBottom: 4,
                    }}>
                        {t("Tendencia de mis cursos")}
                    </Text>
                    <Text style={{
                        fontSize: 12,
                        color: c.text.secondary,
                        marginBottom: 16,
                    }}>
                        {weeklySubtitle}
                    </Text>
                    <WeeklyTrend 
                        data={vm.attendanceByWeek} 
                        maxWeeks={5}
                        showTrend={true}
                        colorByPerformance={true}
                        onWeekSelect={(weekData) => console.log("Semana seleccionada:", weekData)}
                        selectedWeek={null}
                        academicPeriod={academicPeriod}
                    />
                </Card>
            </View>

            {/* Vista integrada de asistencia diaria */}
            <WeeklyAttendanceView
                weeklyData={vm.attendanceByWeek}
                currentWeekData={vm.attendanceByDay}
                maxWeeks={5}
                showTrend={false}
                colorByPerformance={true}
                academicPeriod={academicPeriod}
                weeklyTitle={t("Tendencia de mis cursos")}                weeklySubtitle={weeklySubtitle}
                dailyTitle={t("Asistencia por día")}
                currentWeekLabel={t("En mis cursos esta semana")}
                isSmall={isSmall}
            />

            {/* Estudiantes en riesgo del teacher */}
            {vm.teacherData.myAtRiskStudents.length > 0 && (
                <View>
                    <Text style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: c.text.primary,
                        marginBottom: 12,
                    }}>
                        {t("Mis Estudiantes en Riesgo")}
                    </Text>
                    
                    <AtRiskStudentsList
                        students={vm.teacherData.myAtRiskStudents}
                        maxItems={10}
                        navigation={navigation}
                        onStudentPress={(student) => {
                            console.log("Ver detalle estudiante:", student);
                        }}
                    />
                </View>
            )}
        </>
    );
}

// ──────────────────────────────────────────────────────────────
// STUDENT DASHBOARD — Vista personal del estudiante
// ──────────────────────────────────────────────────────────────

function StudentDashboard({ vm, permissions, isSmall, c, t }) {
    // Estado para el período académico (reactivo a cambios en Settings)
    const [academicPeriod, setAcademicPeriod] = useState(() => getConfiguredAcademicPeriodType());
    
    // Escuchar cambios en la configuración institucional
    useEffect(() => {
        const cleanup = onInstitutionConfigChange((newConfig) => {
            if (newConfig.academicPeriodType && newConfig.academicPeriodType !== academicPeriod) {
                setAcademicPeriod(newConfig.academicPeriodType);
            }
        });
        return cleanup;
    }, [academicPeriod]);
    
    // Hook para orquestar selección de semanas
    const {
        selectedWeek,
        handleWeekSelect,
        handleResetToCurrentWeek,
        weeklyTrendProps,
        dailyBarChartProps,
        currentWeekNumber,
        isCurrentWeek,
    } = useWeeklyAttendanceController(vm.attendanceByWeek, vm.attendanceByDay);
    
    // Obtener subtítulo con el período académico reactivo
    const weeklySubtitle = getWeeklyTrendSubtitle(academicPeriod, t);
    
    // Early return DESPUÉS de todos los hooks
    if (!vm.studentData) return <PanelDataState isLoading={vm.isLoading} t={t} />;

    // Label dinámico: si es la semana actual mostrar "Esta semana (Sem X)", sino "Sem X"
    const weekLabel = isCurrentWeek && currentWeekNumber
        ? `${t("Esta semana")} (Sem ${currentWeekNumber})` 
        : selectedWeek 
            ? selectedWeek.week 
            : t("Esta semana");

    return (
        <>
            {/* Stats personales */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {vm.stats.map((stat) => (
                    <View key={stat.label} style={{ 
                        flexBasis: isSmall ? "47%" : "23%", 
                        flexGrow: 1 
                    }}>
                        <StatCard
                            label={stat.label}
                            value={stat.value}
                            icon={<Feather name={stat.icon} size={20} color={stat.color} />}
                            trend={stat.change ? (stat.change > 0 ? "up" : "down") : undefined}
                            trendValue={stat.change ? `${Math.abs(stat.change)}%` : undefined}
                            color={stat.color}
                        />
                    </View>
                ))}
            </View>

            {/* Gráficas personales del estudiante */}
            <View style={{ flexDirection: isSmall ? "column" : "row", gap: 16 }}>
                <Card style={{ flex: 1 }}>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: c.text.primary,
                        marginBottom: 4,
                    }}>
                        {t("Mi asistencia semanal")}
                    </Text>
                    <Text style={{
                        fontSize: 12,
                        color: c.text.secondary,
                        marginBottom: 16,
                    }}>
                        {weeklySubtitle}
                    </Text>
                    <WeeklyTrend 
                        {...weeklyTrendProps}
                        maxWeeks={5}
                        showTrend={true}
                        colorByPerformance={true}
                    />
                </Card>

                <Card style={{ flex: 1 }}>
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 4,
                    }}>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: c.text.primary,
                        }}>
                            {t("Mi asistencia diaria")}
                        </Text>
                        {!isCurrentWeek && (
                            <TouchableOpacity
                                onPress={handleResetToCurrentWeek}
                                style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 4,
                                    backgroundColor: c.status.info + "15",
                                }}
                            >
                                <Text style={{
                                    fontSize: 10,
                                    fontWeight: "600",
                                    color: c.status.info,
                                }}>
                                    {currentWeekNumber 
                                        ? `${t("Ver semana actual")} (Sem ${currentWeekNumber})`
                                        : t("Ver semana actual")
                                    }
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={{
                        fontSize: 12,
                        color: c.text.secondary,
                        marginBottom: 16,
                    }}>
                        {weekLabel}
                    </Text>
                    <DailyBarChart 
                        {...dailyBarChartProps}
                        height={100}
                        showLegend={true}
                        showSummary={true}
                    />
                </Card>
            </View>

            {/* Asistencia por curso del estudiante */}
            <Card>
                <Text style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: c.text.primary,
                    marginBottom: 4,
                }}>
                    {t("Asistencia por curso")}
                </Text>
                <Text style={{
                    fontSize: 12,
                    color: c.text.secondary,
                    marginBottom: 16,
                }}>
                    {t("Mi rendimiento en cada curso")}
                </Text>
                <View style={{ gap: 14 }}>
                    {vm.courseAttendance.map(item => (
                        <View key={item.course}>
                            <View style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 8,
                            }}>
                                <Text style={{
                                    fontSize: 13,
                                    fontWeight: "500",
                                    color: c.text.primary,
                                    flex: 1,
                                }} numberOfLines={1}>
                                    {item.courseName}
                                </Text>
                                <Text style={{
                                    fontSize: 13,
                                    fontWeight: "700",
                                    color: item.barColor,
                                    marginLeft: 8,
                                }}>
                                    {item.rate}%
                                </Text>
                            </View>
                            <ProgressBar
                                value={item.rate}
                                color={item.barColor}
                                size="md"
                            />
                        </View>
                    ))}
                </View>
            </Card>

            {/* Actividad reciente */}
            <Card>
                <Text style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: c.text.primary,
                    marginBottom: 16,
                }}>
                    {t("Actividad reciente")}
                </Text>
                <View style={{ gap: 12 }}>
                    {vm.recentActivity.slice(0, 5).map(item => (
                        <View key={item.id} style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 10,
                        }}>
                            <View style={{ marginTop: 2 }}>
                                <AttendanceStatusIcon status={item.status} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{
                                    fontSize: 13,
                                    fontWeight: "600",
                                    color: c.text.primary,
                                }}>
                                    {item.student}
                                </Text>
                                <Text style={{
                                    fontSize: 12,
                                    color: c.text.secondary,
                                }}>
                                    {item.course} — {item.time}
                                </Text>
                            </View>
                            <AttendanceStatusBadge status={item.status} />
                        </View>
                    ))}
                </View>
            </Card>
        </>
    );
}

// ──────────────────────────────────────────────────────────────
// DASHBOARD VIEW PRINCIPAL
// ──────────────────────────────────────────────────────────────

export default function DashboardView({ navigation: navigationProp }) {
    const { isSmall } = useResponsive();
    const { theme }   = useTheme();
    const navigationFromHook = useNavigation();
    const navigation = navigationProp || navigationFromHook;
    
    const c           = theme.colors;
    const vm          = useDashboardViewModel();
    const { t }       = useTranslation();
    const permissions = useRolePermissions();

    // Determinar título según rol
    const dashboardTitle = {
        admin: t("Panel de Administración"),
        teacher: t("Mi Panel de Instructor"),
        student: t("Mi Panel Personal"),
    }[vm.userRole] || t("Dashboard");

    const dashboardSubtitle = {
        admin: t("Vista completa del sistema"),
        teacher: t("Gestión de tus fichas y estudiantes"),
        student: t("Tu progreso y asistencia"),
    }[vm.userRole] || vm.todayLabel;

    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            <PageHeader
                title={dashboardTitle}
                subtitle={dashboardSubtitle}
                actions={
                    permissions.canRegisterFace && (
                        <Button 
                            variant="primary" 
                            size="sm"
                            leftIcon={<Feather name="camera" size={16} color="#fff" />}
                            onPress={() => navigation.navigate("AttendanceKiosk")}
                        >
                            {t("Tomar asistencia")}
                        </Button>
                    )
                }
            />
            <ScrollView
                contentContainerStyle={{ padding: isSmall ? 16 : 24, gap: 24 }}
                showsVerticalScrollIndicator={false}
            >

            {/* Renderizar dashboard según rol */}
            {vm.userRole === "admin" && (
                <AdminDashboard 
                    vm={vm} 
                    permissions={permissions}
                    isSmall={isSmall}
                    c={c}
                    t={t}
                    navigation={navigation}
                />
            )}

            {vm.userRole === "teacher" && (
                <TeacherDashboard 
                    vm={vm}
                    permissions={permissions}
                    isSmall={isSmall}
                    c={c}
                    t={t}
                    navigation={navigation}
                />
            )}

            {vm.userRole === "student" && (
                <StudentDashboard 
                    vm={vm} 
                    permissions={permissions}
                    isSmall={isSmall}
                    c={c}
                    t={t}
                />
            )}
            </ScrollView>
        </View>
    );
}
