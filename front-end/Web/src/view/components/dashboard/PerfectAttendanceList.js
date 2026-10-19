// ============================================================
//  PerfectAttendanceList — Estudiantes con asistencia perfecta
// ============================================================
//  Muestra estudiantes destacados por su excelente asistencia
//  Reconocimiento visual de su compromiso
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card, Badge, Avatar, ProgressBar } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { getAttendanceThresholds } from "../../../models/data/userDerivedData";
import { useAttendanceColor } from "../common/badges/StatusBadge";

/**
 * Componente interno para renderizar cada estudiante destacado con color dinámico
 */
function StudentRow({ student, isLast, onPress, c, t }) {
    const thresholds = getAttendanceThresholds();
    const attColor = useAttendanceColor(student.attendanceRate);
    
    // Perfect = 100%, Excellent = >= excellent threshold
    const isPerfect = student.attendanceRate === 100;
    const isExcellent = student.attendanceRate >= thresholds.excellent;

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
                backgroundColor: isPerfect 
                    ? c.status.successLight 
                    : "transparent",
            }}
        >
            {/* Avatar con badge de estrella */}
            <View style={{ position: "relative" }}>
                <Avatar name={student.name} size={48} />
                <View style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: isPerfect ? "#FFD700" : attColor,
                    borderWidth: 2,
                    borderColor: c.background.surface,
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <Text style={{ fontSize: 10 }}>
                        {isPerfect ? "⭐" : "✓"}
                    </Text>
                </View>
            </View>

            {/* Información */}
            <View style={{ flex: 1, gap: 6 }}>
                {/* Header: Nombre + Badge */}
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
                        <Badge 
                            variant={isExcellent ? "success" : "warning"} 
                            size="sm"
                        >
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

                    {/* Stats: Racha */}
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
                            <Feather name="trending-up" size={12} color={attColor} />
                            <Text style={{
                                fontSize: 11,
                                color: c.text.secondary,
                            }}>
                                {student.streak}
                            </Text>
                        </View>
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
 * Lista de estudiantes con asistencia perfecta o casi perfecta
 * Usa umbrales dinámicos desde configuración
 * 
 * @param {Array} students - Array de estudiantes destacados
 * @param {number} maxItems - Número máximo de items (default: 5)
 * @param {function} onStudentPress - Callback al presionar un estudiante
 * @param {object} navigation - Objeto de navegación para redireccionar
 */
export function PerfectAttendanceList({
    students = [],
    maxItems = 5,
    onStudentPress,
    navigation,
}) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    const displayedStudents = students.slice(0, maxItems);

    if (students.length === 0) {
        return (
            <Card>
                <View style={{ padding: 16, alignItems: "center" }}>
                    <Feather name="award" size={32} color={c.text.secondary} />
                    <Text style={{
                        fontSize: 14,
                        color: c.text.secondary,
                        marginTop: 8,
                    }}>
                        {t("No hay datos disponibles")}
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
                        attendanceFilter: "gt" 
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
                        +{students.length - maxItems} {t("estudiantes destacados más")}
                    </Text>
                </TouchableOpacity>
            )}
        </Card>
    );
}

export default PerfectAttendanceList;
