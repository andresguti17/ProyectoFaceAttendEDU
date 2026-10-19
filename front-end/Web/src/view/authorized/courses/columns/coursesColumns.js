// ============================================================
//  FaceAttend EDU — Courses Columns Definition
//
//  Definición centralizada de columnas para la tabla de cursos.
//  
//  Cada columna define:
//  - id: identificador único
//  - label: clave de traducción
//  - flex: ancho relativo
//  - align: alineación del contenido
//  - render: función que renderiza el contenido
//  - visible: función que determina si se muestra (opcional)
//
//  Para agregar una columna: añade un objeto al array COLUMNS.
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Badge, ProgressBar } from "../../../components/common";
import { useAttendanceColor } from "../../../components/common/badges/StatusBadge";

// ── Constantes ────────────────────────────────────────────

const LAYOUT = {
    colorBarWidth: 4,
    colorBarHeight: 28,
    iconSize: 16,
};

// ── Componente para renderizar asistencia con color dinámico ──

function AttendanceCell({ attendance }) {
    const attColor = useAttendanceColor(attendance || 0);
    
    return (
        <View style={{ width: "100%", maxWidth: 120, alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: attColor }}>
                {attendance || 0}%
            </Text>
            <ProgressBar value={attendance || 0} color={attColor} height={5} />
        </View>
    );
}

// ── Definición de columnas ────────────────────────────────

export const COLUMNS = [
    {
        id: "color",
        label: "",
        flex: 0.2,
        align: "center",
        render: (course) => (
            <View
                style={{
                    width: LAYOUT.colorBarWidth,
                    height: LAYOUT.colorBarHeight,
                    backgroundColor: course.color || "#666",
                    borderRadius: 2,
                }}
            />
        ),
    },
    {
        id: "code",
        label: "Código",
        flex: 1,
        align: "left",
        contentWidth: 120,
        headerOffsetX: 0,
        render: (course, { c }) => (
            <View style={{ flexShrink: 1 }}>
                <Text
                    numberOfLines={1}
                    style={{
                        fontWeight: "700",
                        fontSize: 13,
                        color: course.color || c.brand.primary,
                        letterSpacing: 0.5,
                    }}
                >
                    {course.code}
                </Text>
                <Text
                    numberOfLines={1}
                    style={{ fontSize: 11, color: c.text.secondary, marginTop: 2 }}
                >
                    {course.semester || "2024-2"}
                </Text>
            </View>
        ),
    },
    {
        id: "name",
        label: "Nombre del curso",
        flex: 2.5,
        align: "left",
        contentWidth: 220,
        offsetX: 0,
        render: (course, { c }) => (
            <View style={{ flexShrink: 1 }}>
                <Text
                    numberOfLines={1}
                    style={{ fontWeight: "600", fontSize: 14, color: c.text.primary }}
                >
                    {course.name}
                </Text>
                <Text
                    numberOfLines={1}
                    style={{ fontSize: 12, color: c.text.secondary, marginTop: 2 }}
                >
                    {course.program || course.name}
                </Text>
            </View>
        ),
    },
    {
        id: "instructor",
        label: "Instructor",
        flex: 1.8,
        align: "left",
        contentWidth: 150,
        headerOffsetX: -8,
        render: (course, { c }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
                <Feather name="user" size={LAYOUT.iconSize - 2} color={c.text.secondary} />
                <Text
                    numberOfLines={1}
                    style={{ flexShrink: 1, fontSize: 13, color: c.text.primary }}
                >
                    {course.professor || "—"}
                </Text>
            </View>
        ),
    },
    {
        id: "schedule",
        label: "Horario",
        flex: 1.4,
        align: "left",
        contentWidth: 130,
        headerOffsetX: -8,
        visible: ({ isDesktop }) => isDesktop !== false, // Solo en desktop
        render: (course, { c }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
                <Feather name="clock" size={LAYOUT.iconSize - 2} color={c.text.secondary} />
                <Text
                    numberOfLines={1}
                    style={{ flexShrink: 1, fontSize: 12, color: c.text.secondary }}
                >
                    {course.schedule || "—"}
                </Text>
            </View>
        ),
    },
    {
        id: "room",
        label: "Aula",
        flex: 0.9,
        align: "center",
        visible: ({ isDesktop }) => isDesktop !== false, // Solo en desktop
        render: (course, { c }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name="map-pin" size={LAYOUT.iconSize - 2} color={c.text.secondary} />
                <Text style={{ fontSize: 13, color: c.text.secondary, fontWeight: "500" }}>
                    {course.room || "—"}
                </Text>
            </View>
        ),
    },
    {
        id: "students",
        label: "Estudiantes",
        flex: 1.1,
        align: "center",
        render: (course, { c }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name="users" size={LAYOUT.iconSize} color={c.brand.primary} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: c.text.primary }}>
                    {course.students || 0}
                </Text>
            </View>
        ),
    },
    {
        id: "attendance",
        label: "Asistencia",
        flex: 1.3,
        align: "center",
        render: (course) => <AttendanceCell attendance={course.avgAttendance} />,
    },
    {
        id: "status",
        label: "Estado",
        flex: 0.9,
        align: "center",
        render: (course, { t }) => {
            const statusVariant = {
                active: "success",
                inactive: "default",
                completed: "primary",
            }[course.status] || "default";
            
            const statusLabel = {
                active: t("Activo"),
                inactive: t("Inactivo"),
                completed: t("Finalizado"),
            }[course.status] || t("Desconocido");
            
            return (
                <Badge variant={statusVariant}>{statusLabel}</Badge>
            );
        },
    },
];

// ── Vista compacta (móvil) ────────────────────────────────

/**
 * createCompactRowConfig - Crea configuración para la vista compacta móvil
 * 
 * @param {Object} options - Opciones de configuración
 * @param {boolean} options.showStatus - Mostrar badge de estado
 * @returns {Object} Configuración para CoursesTable compactConfig
 */
export function createCompactRowConfig({ showStatus = true }) {
    return {
        render: (course, { t, c }) => {
            // Hook para color dinámico - necesita ser llamado dentro del render
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const attColor = useAttendanceColor(course.avgAttendance || 0);
            
            return (
                <>
                    {/* Barra de color + Info principal */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        {/* Barra de color */}
                        <View
                            style={{
                                width: 3,
                                height: 44,
                                backgroundColor: course.color || "#666",
                                borderRadius: 2,
                            }}
                        />
                        
                        {/* Info del curso */}
                        <View style={{ flexShrink: 1, flex: 1 }}>
                            <Text
                                numberOfLines={1}
                                style={{
                                    fontWeight: "700",
                                    fontSize: 12,
                                    color: course.color || c.brand.primary,
                                    letterSpacing: 0.5,
                                }}
                            >
                                {course.code}
                            </Text>
                            <Text
                                numberOfLines={1}
                                style={{ fontWeight: "600", fontSize: 14, color: c.text.primary, marginTop: 2 }}
                            >
                                {course.name}
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                                <Feather name="user" size={11} color={c.text.secondary} />
                                <Text
                                    numberOfLines={1}
                                    style={{ fontSize: 11, color: c.text.secondary }}
                                >
                                    {course.professor || "—"}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Métricas a la derecha */}
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Feather name="users" size={12} color={c.brand.primary} />
                            <Text style={{ fontSize: 12, fontWeight: "600", color: c.text.primary }}>
                                {course.students || 0}
                            </Text>
                        </View>
                        
                        <Text style={{ fontSize: 12, fontWeight: "700", color: attColor }}>
                            {course.avgAttendance || 0}%
                        </Text>
                        
                        {showStatus && (
                            <Badge 
                                variant={course.status === "active" ? "success" : "default"}
                            >
                                {course.status === "active" ? t("Activo") : t("Inactivo")}
                            </Badge>
                        )}
                    </View>
                </>
            );
        },
    };
}
