// ============================================================
//  FaceAttend EDU — AdminReports
//
//  Vista de reportes para administradores y profesores.
//  Maneja tres vistas según el parámetro section:
//  - section=null/"all": Lista de estudiantes en riesgo
//  - section="historicos": Historial completo de asistencias
//  - section="sanciones": Registro de sanciones aplicadas
// ============================================================

import React, { useState, useMemo, useRef } from "react";
import { View, ScrollView, Text, TouchableOpacity, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { PageHeader, Button, Card, Loader, Avatar, Badge, EmptyState, ProgressBar } from "../../components/common";
import { useTheme } from "../../components/hooks/useTheme";
import { useResponsive } from "../../components/hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useRolePermissions } from "../../../viewmodels/useRolePermissions";
import { useAttendanceColor } from "../../components/common/badges/StatusBadge";
import { getAttendanceThresholds, getAtRiskStudents } from "../../../models/data/userDerivedData";
import { getInstitutionConfig } from "../../../core/config/institutionConfig";
import { useAppData } from "../../../context/AppDataContext";
import { usePushNotification } from "../../components/common/feedback/PushNotification";
import { HistoricosSection, SancionesSection } from "./sections";
import { createBulkSanctions, hasActiveSanctions } from "../../../models/data/sanctionsData";
import { getRelativeTime } from "../../../core/utils/dates";

// ── Componente interno StudentRow (adaptado de AtRiskStudentsList) ────

function StudentRow({ student, index, isLast, onPress, onNotify }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    
    const config = getInstitutionConfig();
    const thresholds = getAttendanceThresholds();
    const attColor = useAttendanceColor(student.attendanceRate);
    
    // Calcular umbral de advertencia crítica dinámicamente
    const criticalDaysThreshold = Math.ceil(config.daysUntilSanction / 2);
    
    // Determinar nivel de riesgo basándose en umbrales dinámicos (IGUAL QUE DASHBOARD)
    const isHighRisk = student.attendanceRate < thresholds.danger || 
                       student.daysUntilSanction <= criticalDaysThreshold;
    const isMediumRisk = !isHighRisk && student.attendanceRate < thresholds.warning;
    
    let variant = "warning";
    let icon = "alert-circle";
    let bgColor = c.status.warningLight;
    
    if (isHighRisk) {
        variant = "danger";
        icon = "alert-octagon";
        bgColor = c.status.dangerLight;
    } else if (isMediumRisk) {
        variant = "warning";
        icon = "alert-triangle";
        bgColor = c.status.warningLight;
    }
    
    // Formatear última asistencia
    const lastAttendanceText = student.lastAttendanceDate 
        ? getRelativeTime(student.lastAttendanceDate)
        : student.lastAttendance || t("Sin registro");

    return (
        <TouchableOpacity
            onPress={() => onPress?.(student.id)}
            style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                gap: 12,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: c.border.primary,
                backgroundColor: bgColor,
            }}
        >
            {/* Avatar con indicador de riesgo */}
            <View style={{ position: "relative" }}>
                <Avatar name={student.name} size={48} />
                <View style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: attColor,
                    borderWidth: 2,
                    borderColor: bgColor,
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <Feather name={icon} size={10} color="#fff" />
                </View>
            </View>

            {/* Información */}
            <View style={{ flex: 1, gap: 6 }}>
                {/* Header: Nombre + Última asistencia + Badge */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                }}>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: c.text.primary,
                        flex: 1,
                    }} numberOfLines={1}>
                        {student.name}
                    </Text>

                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                    }}>
                        <Text style={{
                            fontSize: 11,
                            color: c.text.disabled,
                        }}>
                            {lastAttendanceText}
                        </Text>
                        
                        <Badge variant={variant} size="sm">
                            {student.attendanceRate}%
                        </Badge>
                    </View>
                </View>

                {/* Segunda línea: Código + Ficha + Stats */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                }}>
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        flex: 1,
                    }}>
                        <Text style={{ fontSize: 12, color: c.text.secondary }}>
                            {student.code}
                        </Text>
                        <Text style={{ fontSize: 12, color: c.text.secondary }}>
                            • {student.fichaName || student.courseName}
                        </Text>
                    </View>

                    {/* Stats: faltas + seguidas */}
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                    }}>
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                        }}>
                            <Feather name="x-circle" size={12} color={c.status.danger} />
                            <Text style={{ fontSize: 11, color: c.text.secondary }}>
                                {student.totalAbsences} {t("faltas")}
                            </Text>
                        </View>

                        {student.consecutiveAbsences > 0 && (
                            <View style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                            }}>
                                <Feather name="repeat" size={12} color={c.status.warning} />
                                <Text style={{ fontSize: 11, color: c.text.secondary }}>
                                    {student.consecutiveAbsences} {t("seguidas")}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Barra de progreso */}
                <ProgressBar
                    value={student.attendanceRate}
                    color={attColor}
                    size="sm"
                />
                
                {/* Mensaje informativo del porque está en riesgo */}
                {(() => {
                    // Determinar el mensaje prioritario según la razón de riesgo
                    if (student.hasExceededConsecutiveDays) {
                        // Caso 1: Ausencias consecutivas excedidas (CRÍTICO)
                        return (
                            <View style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                marginTop: 2,
                            }}>
                                <Feather name="alert-octagon" size={10} color={c.status.danger} />
                                <Text style={{
                                    fontSize: 10,
                                    color: c.status.danger,
                                    fontWeight: "700",
                                }}>
                                    {t("Sanción por ausencias consecutivas")} ({student.consecutiveAbsences} {t("días seguidos")})
                                </Text>
                            </View>
                        );
                    } else if (student.daysUntilSanction !== undefined && student.daysUntilSanction <= criticalDaysThreshold) {
                        // Caso 2: Días hasta sanción en zona crítica
                        return (
                            <View style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                marginTop: 2,
                            }}>
                                <Feather 
                                    name={student.daysUntilSanction === 0 ? "alert-octagon" : "clock"} 
                                    size={10} 
                                    color={student.daysUntilSanction === 0 ? c.status.danger : c.status.warning} 
                                />
                                <Text style={{
                                    fontSize: 10,
                                    color: student.daysUntilSanction === 0 ? c.status.danger : c.status.warning,
                                    fontWeight: "600",
                                }}>
                                    {student.daysUntilSanction === 0
                                        ? t("Umbral de sanción alcanzado")
                                        : `${student.daysUntilSanction} ${t("días hasta posible sanción")}`
                                    }
                                </Text>
                            </View>
                        );
                    } else if (student.attendanceRate < config.minAttendance) {
                        // Caso 3: Asistencia por debajo del umbral mínimo configurado
                        const attendanceGap = config.minAttendance - student.attendanceRate;
                        return (
                            <View style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                marginTop: 2,
                            }}>
                                <Feather 
                                    name="trending-down" 
                                    size={10} 
                                    color={isHighRisk ? c.status.danger : c.status.warning} 
                                />
                                <Text style={{
                                    fontSize: 10,
                                    color: isHighRisk ? c.status.danger : c.status.warning,
                                    fontWeight: "600",
                                }}>
                                    {t("Asistencia por debajo del mínimo requerido")} ({config.minAttendance}%) · {t("Falta")} {attendanceGap.toFixed(1)}%
                                </Text>
                            </View>
                        );
                    } else {
                        // Caso 4: En riesgo general (fallback informativo)
                        return (
                            <View style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                marginTop: 2,
                            }}>
                                <Feather name="info" size={10} color={c.text.secondary} />
                                <Text style={{
                                    fontSize: 10,
                                    color: c.text.secondary,
                                    fontWeight: "500",
                                }}>
                                    {t("Estudiante requiere seguimiento de asistencia")}
                                </Text>
                            </View>
                        );
                    }
                })()}
            </View>

            {/* Botón de notificación individual con borde */}
            <TouchableOpacity
                onPress={(e) => {
                    e.stopPropagation();
                    onNotify(student);
                }}
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: c.background.surface,
                    borderWidth: 2,
                    borderColor: c.status.danger,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: c.status.danger,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 3,
                }}
            >
                <Feather name="bell" size={18} color={c.status.danger} />
            </TouchableOpacity>
            
            <Feather name="chevron-right" size={22} color={c.text.secondary} />
        </TouchableOpacity>
    );
}

// ── AdminReports Component ────────────────────────────────

export function AdminReports({ section, courseFilter }) {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const permissions = useRolePermissions();
    const appData = useAppData();
    const pushNotification = usePushNotification();
    const c = theme.colors;

    // Estado y animación para el botón de recargar
    const [isReloading, setIsReloading] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const rotateAnim = useRef(new Animated.Value(0)).current;
    
    // Crear interpolación una sola vez
    const rotateInterpolation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    // ── IMPORTANTE: Todos los hooks deben estar ANTES de cualquier return early ──
    
    // Estados para la sección de Históricos (siempre inicializados, se usan solo si es necesario)
    const [historicosStats, setHistoricosStats] = useState({ totalRecords: 0, totalUsers: 0 });
    const [showHistoricosFilters, setShowHistoricosFilters] = useState(false);
    
    // Lógica de estudiantes en riesgo (se calcula siempre para respetar reglas de hooks)
    const studentsData = useMemo(() => {
        const config = getInstitutionConfig();
        const atRiskStudents = getAtRiskStudents(appData.students, config.minAttendance);
        
        // Filtrar usuarios que ya tienen sanciones activas
        const pendingStudents = atRiskStudents.filter(student => 
            !hasActiveSanctions(student.studentId)
        );
        
        // Formatear estudiantes para StudentRow
        const formattedStudents = pendingStudents.map(student => {
            const originalStudent = appData.students.find(s => s.id === student.studentId);
            return {
                ...originalStudent,
                id: student.studentId,
                name: student.name,
                code: student.code,
                course: student.ficha,
                courseName: student.fichaName,
                fichaId: student.ficha,
                fichaName: student.fichaName,
                attendance: student.attendanceRate,
                attendanceRate: student.attendanceRate,
                riskLevel: student.riskLevel,
                totalAbsences: student.totalAbsences,
                consecutiveAbsences: student.consecutiveAbsences,
                daysUntilSanction: student.daysUntilSanction,
                hasExceededConsecutiveDays: student.hasExceededConsecutiveDays,
                lastAttendance: student.lastAttendance,
                lastAttendanceDate: originalStudent?.lastAttendanceDate || student.lastAttendanceDate,
            };
        });

        return {
            students: formattedStudents,
            isLoading: appData.isLoading,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appData.students, appData.isLoading, refreshTrigger]); // refreshTrigger fuerza recálculo

    // ── Handlers (ANTES de cualquier return) ──────────────
    
    // Handler para notificar estudiantes
    const handleNotifyAll = React.useCallback(() => {
        const students = studentsData.students;
        if (students.length === 0) return;
        
        // Crear sanciones en lote para todos los estudiantes
        createBulkSanctions(students);
        
        // Mostrar notificación
        pushNotification.success(
            'Notificación enviada', 
            `Se han notificado ${students.length} estudiantes en riesgo`
        );
        
        // Forzar recálculo inmediato
        setRefreshTrigger(prev => prev + 1);
    }, [studentsData.students, pushNotification]);

    // Handler para notificar un estudiante individual
    const handleNotifyOne = React.useCallback((student) => {
        // Crear sanción individual
        createBulkSanctions([student]);
        
        // Mostrar notificación
        pushNotification.success(
            'Notificación enviada', 
            `Se ha notificado a ${student.name}`
        );
        
        // Forzar recálculo inmediato
        setRefreshTrigger(prev => prev + 1);
    }, [pushNotification]);

    // Handler para ver detalles de estudiante
    const handleViewStudent = React.useCallback((studentId) => {
        console.log("Ver detalles:", studentId);
        // TODO: Implementar navegación a detalle de estudiante
    }, []);

    // Handler para recargar la lista
    const handleReload = React.useCallback(async () => {
        if (isReloading) return; // Prevenir múltiples clicks
        
        setIsReloading(true);
        rotateAnim.setValue(0);
        
        // Marcar inicio del proceso
        const startTime = Date.now();
        
        // Forzar recálculo
        setRefreshTrigger(prev => prev + 1);
        
        // Esperar al siguiente frame para que React termine de renderizar
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Calcular duración real del proceso
        const actualDuration = Date.now() - startTime;
        
        // Animar por la duración real del proceso
        Animated.timing(rotateAnim, {
            toValue: 20,
            duration: Math.max(actualDuration, 2000), // Mínimo 200ms para que sea visible
            useNativeDriver: true,
            isInteraction: false,
        }).start(() => {
            // Resetear al finalizar
            rotateAnim.setValue(0);
            setIsReloading(false);
        });
    }, [isReloading, rotateAnim]);

    // ── Determinar qué sección mostrar (DESPUÉS de todos los hooks) ──
    const isHistoricos = section === "historicos";
    const isSanciones = section === "sanciones";

    // ── Renderizar sección de Históricos ──────────────────
    if (isHistoricos) {
        return (
            <>
                {/* Header compacto con estadísticas */}
                <View
                    style={{
                        paddingTop: 16,
                        paddingBottom: 16,
                        paddingHorizontal: isSmall ? 16 : 24,
                        backgroundColor: c.background.app,
                        borderBottomWidth: 1,
                        borderBottomColor: c.border.primary,
                    }}
                >
                    <View style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 24,
                    }}>
                        {/* Lado izquierdo: Título y Subtítulo */}
                        <View style={{ flex: 1 }}>
                            <Text style={{
                                fontSize: 24,
                                fontWeight: "700",
                                color: c.text.primary,
                                marginBottom: 4,
                            }}>
                                {t("Históricos")}
                            </Text>
                            <Text style={{
                                fontSize: 14,
                                color: c.text.secondary,
                            }}>
                                {t("Historial completo de asistencia de todos los usuarios")}
                            </Text>
                        </View>

                        {/* Lado derecho: Estadísticas y Botón de Filtros */}
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 32,
                        }}>
                            {/* Estadísticas */}
                            <View style={{
                                flexDirection: "row",
                                gap: 32,
                            }}>
                                <View>
                                    <Text style={{
                                        fontSize: 12,
                                        color: c.text.secondary,
                                        fontWeight: "500",
                                        marginBottom: 4,
                                    }}>
                                        {t("Total registros")}
                                    </Text>
                                    <Text style={{
                                        fontSize: 24,
                                        fontWeight: "700",
                                        color: c.text.primary,
                                    }}>
                                        {historicosStats.totalRecords}
                                    </Text>
                                </View>
                                
                                <View>
                                    <Text style={{
                                        fontSize: 12,
                                        color: c.text.secondary,
                                        fontWeight: "500",
                                        marginBottom: 4,
                                    }}>
                                        {t("Usuarios registrados")}
                                    </Text>
                                    <Text style={{
                                        fontSize: 24,
                                        fontWeight: "700",
                                        color: c.text.primary,
                                    }}>
                                        {historicosStats.totalUsers}
                                    </Text>
                                </View>
                            </View>

                            {/* Botón de filtros */}
                            <TouchableOpacity
                                onPress={() => setShowHistoricosFilters(!showHistoricosFilters)}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    backgroundColor: c.background.surface,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: c.border.primary,
                                }}
                            >
                                <Feather name="filter" size={16} color={c.text.primary} />
                                <Text style={{
                                    fontSize: 14,
                                    fontWeight: "500",
                                    color: c.text.primary,
                                }}>
                                    {t("Filtros")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={{
                        padding: isSmall ? 16 : 24,
                        gap: 16,
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    <HistoricosSection 
                        onStatsChange={setHistoricosStats}
                        showFilters={showHistoricosFilters}
                        onToggleFilters={setShowHistoricosFilters}
                        initialCourseFilter={courseFilter}
                    />
                </ScrollView>
            </>
        );
    }

    // ── Renderizar sección de Sanciones ───────────────────
    if (isSanciones) {
        return (
            <>
                <PageHeader
                    title={t("Sanciones")}
                    subtitle={t("Registro de sanciones y alertas aplicadas")}
                />
                <ScrollView
                    contentContainerStyle={{
                        padding: isSmall ? 16 : 24,
                        gap: 16,
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    <SancionesSection />
                </ScrollView>
            </>
        );
    }

    // ── Vista principal: Estudiantes en riesgo ────────────

    // Mostrar loader mientras carga
    if (studentsData.isLoading) {
        return <Loader fullScreen message={t("Cargando reportes...")} />;
    }

    // Datos de estudiantes en riesgo
    const students = studentsData.students;
    const studentCount = students.length;
    const studentLabel = studentCount === 1 ? t("estudiante") : t("estudiantes");

    return (
        <>
            <PageHeader
                title={t("Reportes y Sanciones")}
                subtitle={`${studentCount} ${studentLabel} para reportar o notificar`}
                actions={
                    studentCount > 0 ? (
                        permissions.canNotifyAll && (
                            <Button
                                variant="danger"
                                size="sm"
                                onPress={handleNotifyAll}
                                leftIcon={<Feather name="bell" size={16} color="#fff" />}
                            >
                                {t("Notificar Todos")}
                            </Button>
                        )
                    ) : (
                        <TouchableOpacity
                            onPress={handleReload}
                            disabled={isReloading}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: c.background.secondary,
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: isReloading ? 0.7 : 1,
                            }}
                        >
                            <Animated.View
                                style={{
                                    transform: [{ rotate: rotateInterpolation }]
                                }}
                            >
                                <Feather name="refresh-cw" size={18} color={c.text.primary} />
                            </Animated.View>
                        </TouchableOpacity>
                    )
                }
            />

            <ScrollView
                contentContainerStyle={{
                    padding: isSmall ? 16 : 24,
                    gap: 16,
                }}
                showsVerticalScrollIndicator={false}
            >
                <Card padding={0}>
                    {studentCount === 0 ? (
                        <EmptyState
                            icon="users"
                            title={t("No hay mas usuarios por reportar")}
                            description={t("Todos los estudiantes cumplen con los criterios de asistencia")}
                        />
                    ) : (
                        <>
                            {students.map((student, index) => (
                                <StudentRow 
                                    key={student.id} 
                                    student={student} 
                                    index={index} 
                                    isLast={index === studentCount - 1} 
                                    onPress={handleViewStudent}
                                    onNotify={handleNotifyOne}
                                />
                            ))}
                            
                            {/* Footer dentro del Card */}
                            <View style={{
                                padding: 24,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: c.background.surface,
                                borderTopWidth: 1,
                                borderTopColor: c.border.primary,
                            }}>
                                <Feather name="check-circle" size={24} color={c.status.success} style={{ marginBottom: 8 }} />
                                <Text style={{
                                    fontSize: 14,
                                    color: c.text.secondary,
                                    textAlign: "center",
                                }}>
                                    {t("¡Ya llegaste hasta el final de la lista, no hay más usuarios que mostrar!")}
                                </Text>
                            </View>
                        </>
                    )}
                </Card>
            </ScrollView>
        </>
    );
}
