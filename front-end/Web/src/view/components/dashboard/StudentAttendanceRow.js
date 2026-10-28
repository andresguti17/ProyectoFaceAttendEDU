// ============================================================
//  StudentAttendanceRow — fila de estudiante con su asistencia
// ============================================================
//  Fila común de las listas de estudiantes (en riesgo, destacados y el
//  reporte de riesgo): avatar con marcador, nombre, badge de %, código,
//  ficha, estadísticas y barra de progreso. Cada lista decide colores,
//  marcador y estadísticas.
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Badge, Avatar, ProgressBar } from "../common";
import { getInstitutionConfig } from "../../../core/config/institutionConfig";
import { getAttendanceThresholds } from "../../../models/data/userDerivedData";

/**
 * Nivel de riesgo con umbrales dinámicos.
 * Alto: asistencia < danger o días hasta sanción en zona crítica (mitad de los configurados).
 */
export function getRiskLevel(student, c) {
    const criticalDaysThreshold = Math.ceil(getInstitutionConfig().daysUntilSanction / 2);
    const thresholds = getAttendanceThresholds();
    const isHighRisk = student.attendanceRate < thresholds.danger ||
                       student.daysUntilSanction <= criticalDaysThreshold;
    const isMediumRisk = !isHighRisk && student.attendanceRate < thresholds.warning;

    if (isHighRisk) {
        return { isHighRisk, criticalDaysThreshold, variant: "danger", icon: "alert-octagon", bgColor: c.status.dangerLight };
    }
    return {
        isHighRisk,
        criticalDaysThreshold,
        variant: "warning",
        icon: isMediumRisk ? "alert-triangle" : "alert-circle",
        bgColor: c.status.warningLight,
    };
}

export function StudentStat({ icon, color, c, children }) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name={icon} size={12} color={color} />
            <Text style={{ fontSize: 11, color: c.text.secondary }}>{children}</Text>
        </View>
    );
}

/** Faltas totales y, si hay, faltas seguidas. */
export function AbsenceStats({ student, c, t }) {
    return (
        <>
            <StudentStat icon="x-circle" color={c.status.danger} c={c}>
                {student.totalAbsences} {t("faltas")}
            </StudentStat>
            {student.consecutiveAbsences > 0 && (
                <StudentStat icon="repeat" color={c.status.warning} c={c}>
                    {student.consecutiveAbsences} {t("seguidas")}
                </StudentStat>
            )}
        </>
    );
}

/** Enlace "+N estudiantes más" que abre la gestión de usuarios con el filtro de asistencia. */
export function MoreStudentsLink({ count, label, attendanceFilter, navigation, c }) {
    return (
        <TouchableOpacity
            onPress={() => navigation?.navigate("Users", { section: "students", attendanceFilter })}
            style={{ padding: 12, alignItems: "center", borderTopWidth: 1, borderTopColor: c.border.primary }}
            activeOpacity={0.7}
        >
            <Text style={{ fontSize: 12, color: c.brand.primary, fontWeight: "600" }}>
                +{count} {label}
            </Text>
        </TouchableOpacity>
    );
}

/**
 * @param {object} student - name, code y attendanceRate
 * @param {string} attColor - color de asistencia (barra y marcador)
 * @param {string} backgroundColor - fondo de la fila
 * @param {string} markerColor - fondo del marcador del avatar
 * @param {string} markerBorderColor - borde del marcador (por defecto, la superficie)
 * @param {node} marker - contenido del marcador
 * @param {node} meta - texto antes del badge (opcional)
 * @param {string} badgeVariant - variante del badge de %
 * @param {string} subtitle - ficha/curso tras el código
 * @param {node} stats - estadísticas a la derecha del código
 * @param {node} children - contenido extra bajo la barra
 */
export function StudentAttendanceRow({
    student,
    isLast,
    onPress,
    c,
    attColor,
    backgroundColor,
    markerColor,
    markerBorderColor = c.background.surface,
    marker,
    meta,
    badgeVariant,
    subtitle,
    stats,
    chevronSize = 20,
    children,
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                gap: 12,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: c.border.primary,
                backgroundColor,
            }}
        >
            <View style={{ position: "relative" }}>
                <Avatar name={student.name} size={48} />
                <View style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: markerColor,
                    borderWidth: 2,
                    borderColor: markerBorderColor,
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    {marker}
                </View>
            </View>

            <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: c.text.primary, flex: 1 }} numberOfLines={1}>
                        {student.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {meta != null && (
                            <Text style={{ fontSize: 11, color: c.text.disabled }}>{meta}</Text>
                        )}
                        <Badge variant={badgeVariant} size="sm">
                            {student.attendanceRate}%
                        </Badge>
                    </View>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <Text style={{ fontSize: 12, color: c.text.secondary }}>{student.code}</Text>
                        <Text style={{ fontSize: 12, color: c.text.secondary }}>• {subtitle}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>{stats}</View>
                </View>

                <ProgressBar value={student.attendanceRate} color={attColor} size="sm" />
                {children}
            </View>

            <Feather name="chevron-right" size={chevronSize} color={c.text.secondary} />
        </TouchableOpacity>
    );
}
