// ============================================================
//  AtRiskStudentsList — Lista de estudiantes en riesgo
// ============================================================
//  Muestra estudiantes con riesgo de sanción por inasistencias
//  Ordenados por nivel de riesgo y días hasta sanción
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card, Badge, Avatar, ProgressBar } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { getInstitutionConfig } from "../../../core/config/institutionConfig";
import { getAttendanceThresholds } from "../../../models/data/userDerivedData";
import { useAttendanceColor } from "../common/badges/StatusBadge";

/**
 * Componente interno para renderizar cada estudiante en riesgo con colores dinámicos
 */
function StudentRow({ student, index, isLast, onPress, c, t }) {
    const config = getInstitutionConfig();
    const thresholds = getAttendanceThresholds();
    const attColor = useAttendanceColor(student.attendanceRate);
    
    // Calcular umbral de advertencia crítica dinámicamente (mitad de días configurados)
    const criticalDaysThreshold = Math.ceil(config.daysUntilSanction / 2);
    
    // Determinar nivel de riesgo basándose en umbrales dinámicos
    // Alto riesgo: asistencia < danger O días críticos
    // Medio riesgo: asistencia < warning
    // Bajo riesgo: asistencia < minAttendance
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

    return (
        <TouchableOpacity
            onPress={() => onPress?.(student)}
            style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                gap: 12,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: c.border.primary,
                backgroundColor: index === 0 && isHighRisk 
                    ? bgColor 
                    : "transparent",
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
                    borderColor: c.background.surface,
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <Feather name={icon} size={10} color="#fff" />
                </View>
            </View>

            {/* Información */}
            <View style={{ flex: 1, gap: 6 }}>
                {/* Header: Nombre + (Última asistencia + Badge) */}
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
                            {t("Última")}: {student.lastAttendance}
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
                        <Text style={{
                            fontSize: 12,
                            color: c.text.secondary,
                        }}>
                            {student.code}
                        </Text>
                        <Text style={{
                            fontSize: 12,
                            color: c.text.secondary,
                        }}>
                            • {student.fichaName}
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
                            <Text style={{
                                fontSize: 11,
                                color: c.text.secondary,
                            }}>
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
                                <Text style={{
                                    fontSize: 11,
                                    color: c.text.secondary,
                                }}>
                                    {student.consecutiveAbsences} {t("seguidas")}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Barra de progreso con color dinámico */}
                <ProgressBar
                    value={student.attendanceRate}
                    color={attColor}
                    size="sm"
                />
            </View>

            {/* Chevron - Indicador de clickeable */}
            <Feather name="chevron-right" size={20} color={c.text.secondary} />
        </TouchableOpacity>
    );
}

/**
 * Lista de estudiantes en riesgo de sanción
 * Usa configuración dinámica de umbrales de asistencia y días hasta sanción
 * 
 * @param {Array} students - Array de estudiantes en riesgo
 * @param {number} maxItems - Número máximo de items (default: 10)
 * @param {function} onStudentPress - Callback al presionar un estudiante
 * @param {object} navigation - Objeto de navegación para redireccionar
 * @param {boolean} showActions - Mostrar botón de acción (default: false)
 */
export function AtRiskStudentsList({
    students = [],
    maxItems = 10,
    onStudentPress,
    navigation,
    showActions = false,
}) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    // Ordenar por nivel de riesgo y días hasta sanción (usa datos dinámicos ya calculados)
    const sortedStudents = [...students].sort((a, b) => {
        // Primero ordenar por asistencia (menor a mayor = más riesgo primero)
        return a.attendanceRate - b.attendanceRate;
    });

    const displayedStudents = sortedStudents.slice(0, maxItems);

    if (students.length === 0) {
        return (
            <Card>
                <View style={{ padding: 24, alignItems: "center" }}>
                    <View style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: c.status.successLight,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 12,
                    }}>
                        <Feather name="check-circle" size={32} color={c.status.success} />
                    </View>
                    <Text style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: c.text.primary,
                        marginBottom: 4,
                    }}>
                        {t("¡Excelente!")}
                    </Text>
                    <Text style={{
                        fontSize: 14,
                        color: c.text.secondary,
                        textAlign: "center",
                    }}>
                        {t("No hay estudiantes en riesgo de sanción")}
                    </Text>
                </View>
            </Card>
        );
    }

    return (
        <Card padding={0}>
            {displayedStudents.map((student, index) => (
                <StudentRow
                    key={student.id}
                    student={student}
                    index={index}
                    isLast={index === displayedStudents.length - 1}
                    onPress={onStudentPress}
                    c={c}
                    t={t}
                />
            ))}

            {students.length > maxItems && (
                <TouchableOpacity
                    onPress={() => navigation?.navigate("Users", { 
                        section: "students", 
                        attendanceFilter: "lt" 
                    })}
                    style={{
                        padding: 12,
                        alignItems: "center",
                        borderTopWidth: 1,
                        borderTopColor: c.border.primary,
                    }}
                    activeOpacity={0.7}
                >
                    <Text style={{
                        fontSize: 12,
                        color: c.brand.primary,
                        fontWeight: "600",
                    }}>
                        +{students.length - maxItems} {t("estudiantes más en riesgo")}
                    </Text>
                </TouchableOpacity>
            )}
        </Card>
    );
}

export default AtRiskStudentsList;
