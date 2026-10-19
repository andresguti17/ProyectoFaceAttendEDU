// ============================================================
//  InstructorAttendanceList — Lista de asistencia de instructores
// ============================================================
//  Muestra el resumen de asistencia de todos los instructores
//  con indicadores visuales de su desempeño
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card, Badge, ProgressBar, Avatar } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useAttendanceColor } from "../common/badges/StatusBadge";
import { getAttendanceThresholds } from "../../../models/data/userDerivedData";

/**
 * Componente interno para renderizar cada instructor con color dinámico
 */
function InstructorRow({ instructor, isLast, onPress, c, t }) {
    // Obtener color dinámico basado en asistencia
    const attColor = useAttendanceColor(instructor.attendanceRate);
    const thresholds = getAttendanceThresholds();
    
    // Determinar variante del badge basándose en umbrales dinámicos
    let variant = "danger";
    if (instructor.attendanceRate >= thresholds.excellent) {
        variant = "success";
    } else if (instructor.attendanceRate >= thresholds.warning) {
        variant = "warning";
    }

    return (
        <TouchableOpacity
            onPress={() => onPress?.(instructor)}
            style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                gap: 12,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: c.border.primary,
            }}
        >
            {/* Avatar */}
            <Avatar 
                name={instructor.instructorName} 
                size={48}
            />

            {/* Información */}
            <View style={{ flex: 1, gap: 4 }}>
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
                        {instructor.instructorName}
                    </Text>
                    
                    <Badge variant={variant} size="sm">
                        {instructor.totalClasses > 0 ? `${instructor.attendanceRate}%` : "—"}
                    </Badge>
                </View>

                <Text style={{
                    fontSize: 12,
                    color: c.text.secondary,
                }} numberOfLines={1}>
                    {instructor.department}
                </Text>

                {/* Barra de progreso con color dinámico */}
                <ProgressBar
                    value={instructor.attendanceRate}
                    color={attColor}
                    size="sm"
                />

                {/* Stats mini */}
                <View style={{
                    flexDirection: "row",
                    gap: 8,
                }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Feather name="check-circle" size={12} color={c.status.success} />
                        <Text style={{ fontSize: 11, color: c.text.secondary }}>
                            {instructor.attendedClasses}/{instructor.totalClasses}
                        </Text>
                    </View>

                    {instructor.lateClasses > 0 && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Feather name="clock" size={12} color={c.status.warning} />
                            <Text style={{ fontSize: 11, color: c.text.secondary }}>
                                {instructor.lateClasses} {t("tarde")}
                            </Text>
                        </View>
                    )}

                    {instructor.missedClasses > 0 && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Feather name="x-circle" size={12} color={c.status.danger} />
                            <Text style={{ fontSize: 11, color: c.text.secondary }}>
                                {instructor.missedClasses} {t("falta")}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Icono de acción */}
            <Feather name="chevron-right" size={20} color={c.text.secondary} />
        </TouchableOpacity>
    );
}

/**
 * Lista de asistencia de instructores con colores dinámicos
 * 
 * @param {Array} instructors - Array de objetos de instructor con attendance data
 * @param {function} onInstructorPress - Callback al presionar un instructor
 * @param {number} maxItems - Número máximo de items a mostrar (default: 5)
 */
export function InstructorAttendanceList({ 
    instructors = [], 
    onInstructorPress,
    maxItems = 5,
}) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    const displayedInstructors = instructors.slice(0, maxItems);

    if (instructors.length === 0) {
        return (
            <Card>
                <View style={{ padding: 16, alignItems: "center" }}>
                    <Feather name="users" size={32} color={c.text.secondary} />
                    <Text style={{
                        fontSize: 14,
                        color: c.text.secondary,
                        marginTop: 8,
                    }}>
                        {t("No hay datos de instructores")}
                    </Text>
                </View>
            </Card>
        );
    }

    return (
        <Card padding={0}>
            {displayedInstructors.map((instructor, index) => (
                <InstructorRow
                    key={instructor.id}
                    instructor={instructor}
                    isLast={index === displayedInstructors.length - 1}
                    onPress={onInstructorPress}
                    c={c}
                    t={t}
                />
            ))}
        </Card>
    );
}

export default InstructorAttendanceList;
