// ============================================================
//  AtRiskStudentsList — Lista de estudiantes en riesgo
// ============================================================
//  Muestra estudiantes con riesgo de sanción por inasistencias
//  Ordenados por nivel de riesgo y días hasta sanción
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { getTextOnColor } from "../../../core/theme/generateTheme";
import { Card } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useAttendanceColor } from "../common/badges/StatusBadge";
import { StudentAttendanceRow, AbsenceStats, MoreStudentsLink, getRiskLevel } from "./StudentAttendanceRow";

/**
 * Fila de estudiante en riesgo; solo la primera fila de alto riesgo se resalta.
 */
function StudentRow({ student, index, isLast, onPress, c, t }) {
    const attColor = useAttendanceColor(student.attendanceRate);
    const { isHighRisk, variant, icon, bgColor } = getRiskLevel(student, c);

    return (
        <StudentAttendanceRow
            student={student}
            isLast={isLast}
            onPress={() => onPress?.(student)}
            c={c}
            attColor={attColor}
            backgroundColor={index === 0 && isHighRisk ? bgColor : "transparent"}
            markerColor={attColor}
            marker={<Feather name={icon} size={10} color={getTextOnColor(attColor)} />}
            meta={<>{t("Última")}: {student.lastAttendance}</>}
            badgeVariant={variant}
            subtitle={student.fichaName}
            stats={<AbsenceStats student={student} c={c} t={t} />}
        />
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
                <MoreStudentsLink
                    count={students.length - maxItems}
                    label={t("estudiantes más en riesgo")}
                    attendanceFilter="lt"
                    navigation={navigation}
                    c={c}
                />
            )}
        </Card>
    );
}

export default AtRiskStudentsList;
