// ============================================================
//  PerfectAttendanceList — Estudiantes con asistencia perfecta
// ============================================================
//  Muestra estudiantes destacados por su excelente asistencia
//  Reconocimiento visual de su compromiso
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { getAttendanceThresholds } from "../../../models/data/userDerivedData";
import { useAttendanceColor } from "../common/badges/StatusBadge";
import { StudentAttendanceRow, StudentStat, MoreStudentsLink } from "./StudentAttendanceRow";

/**
 * Fila de estudiante destacado: estrella si tiene 100 %, check si no.
 */
function StudentRow({ student, isLast, onPress, c }) {
    const thresholds = getAttendanceThresholds();
    const attColor = useAttendanceColor(student.attendanceRate);
    const isPerfect = student.attendanceRate === 100;
    const isExcellent = student.attendanceRate >= thresholds.excellent;

    return (
        <StudentAttendanceRow
            student={student}
            isLast={isLast}
            onPress={() => onPress?.(student)}
            c={c}
            attColor={attColor}
            backgroundColor={isPerfect ? c.status.successLight : "transparent"}
            markerColor={isPerfect ? "#FFD700" : attColor}
            marker={<Text style={{ fontSize: 10 }}>{isPerfect ? "⭐" : "✓"}</Text>}
            badgeVariant={isExcellent ? "success" : "warning"}
            subtitle={student.fichaName}
            stats={<StudentStat icon="trending-up" color={attColor} c={c}>{student.streak}</StudentStat>}
        />
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
                />
            ))}

            {students.length > maxItems && (
                <MoreStudentsLink
                    count={students.length - maxItems}
                    label={t("estudiantes destacados más")}
                    attendanceFilter="gt"
                    navigation={navigation}
                    c={c}
                />
            )}
        </Card>
    );
}

export default PerfectAttendanceList;
