// ============================================================
//  FaceAttend EDU — Users Columns Definition
//
//  Definición centralizada de columnas para la tabla de usuarios.
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
import { Badge, Avatar, ProgressBar } from "../../../components/common";

// ── Constantes ────────────────────────────────────────────

const LAYOUT = {
    avatarSize: 36,
    avatarGap: 10,
};

const PROGRAM_HEADERS = {
    colegio: "Colegio",
    ficha: "Ficha",
    curso: "Curso",
};

export const ROLE_VARIANT = {
    student: "default",
    teacher: "default",
    admin: "default",
};

// ── Definición de columnas ────────────────────────────────

export const COLUMNS = [
    {
        id: "role",
        label: "Rol",
        flex: 0.9,
        align: "center",
        visible: ({ roleFilter }) => !roleFilter,
        render: (user, { t, roleVariant }) => (
            <Badge variant={roleVariant}>{t(user.typeLabelKey || "Usuario")}</Badge>
        ),
    },
    {
        id: "name",
        label: "Nombre",
        flex: 2,
        align: "left",
        contentWidth: 240,
        offsetX: 0,
        render: (user, { c }) => (
            <View
                style={{
                    flexShrink: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: LAYOUT.avatarGap,
                }}
            >
                <Avatar name={user.name} size={LAYOUT.avatarSize} />
                <View style={{ flexShrink: 1 }}>
                    <Text
                        numberOfLines={1}
                        style={{ fontWeight: "600", fontSize: 14, color: c.text.primary }}
                    >
                        {user.name}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: c.text.secondary }}>
                        {user.code}
                    </Text>
                </View>
            </View>
        ),
    },
    {
        id: "email",
        label: "Correo",
        flex: 1.7,
        align: "left",
        contentWidth: 135,
        headerOffsetX: -8,
        render: (user, { c }) => (
            <Text
                numberOfLines={1}
                style={{ flexShrink: 1, fontSize: 13, color: c.text.secondary }}
            >
                {user.email || "—"}
            </Text>
        ),
    },
    {
        id: "program",
        label: "Programa",
        // Lo que muestra depende de quién mira la lista:
        //  - Super Admin: colegio (sede) de cada usuario
        //  - Administrador de sede: ficha del estudiante
        //  - Docente: curso
        headerLabel: ({ programMode }) => PROGRAM_HEADERS[programMode] ?? "Programa",
        flex: 1.6,
        align: "left",
        contentWidth: 150,
        headerOffsetX: -10,
        visible: ({ roleFilter }) => roleFilter !== "admin",
        render: (user, { c, courses, programMode, schoolNames }) => {
            let displayName = "—";
            if (programMode === "colegio") {
                displayName = schoolNames?.get?.(String(user.schoolId)) ?? "—";
            } else if (programMode === "ficha") {
                displayName = user.ficha || "—";
            } else {
                // Curso: buscar por código o nombre
                const course = courses?.find(
                    co => co.code === user.course || co.name === user.course || co.id === user.course
                );
                displayName = course ? course.name : user.course || "—";
            }

            return (
                <Text
                    numberOfLines={1}
                    style={{ flexShrink: 1, fontSize: 13, color: c.text.primary }}
                >
                    {displayName}
                </Text>
            );
        },
    },
    {
        id: "attendance",
        label: "Asistencia",
        flex: 1.1,
        align: "center",
        visible: ({ roleFilter }) => roleFilter !== "admin",
        render: (user, { attColor }) => (
            <View style={{ width: "100%", maxWidth: 110, alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: attColor }}>
                    {user.attendance || 0}%
                </Text>
                <ProgressBar value={user.attendance || 0} color={attColor} height={5} />
            </View>
        ),
    },
    {
        id: "biometric",
        label: "Biometría",
        flex: 1,
        align: "center",
        visible: ({ canManage, roleFilter }) => canManage && roleFilter !== "admin",
        render: (user, { t }) => {
            // Calcular estado basado en facial y huella
            const hasFacial = user.hasFacial || false;
            const hasFingerprint = user.hasFingerprint || false;
            
            let biometricStatus = "pending";
            if (hasFacial && hasFingerprint) {
                biometricStatus = "registered";
            } else if (hasFacial || hasFingerprint) {
                biometricStatus = "partial";
            }
            
            const variantMap = {
                registered: "success",
                partial: "warning", 
                pending: "default",
            };
            const labelMap = {
                registered: t("Registrado"),
                partial: t("Parcial"),
                pending: t("Pendiente"),
            };
            return (
                <Badge variant={variantMap[biometricStatus] || "default"}>
                    {labelMap[biometricStatus] || t("Pendiente")}
                </Badge>
            );
        },
    },
    {
        id: "status",
        label: "Estado",
        flex: 0.9,
        align: "center",
        render: (user, { t }) => (
            <Badge variant={user.status === "active" ? "success" : "default"}>
                {user.status === "active" ? t("Activo") : t("Inactivo")}
            </Badge>
        ),
    },
];

// ── Vista compacta (móvil) ────────────────────────────────

/**
 * createCompactRowConfig - Crea configuración para la vista compacta móvil
 * 
 * @param {Object} options - Opciones de configuración
 * @param {boolean} options.showRole - Mostrar badge de rol
 * @param {boolean} options.canManage - Mostrar estado facial
 * @param {string} options.roleFilter - Filtro de rol actual para determinar qué mostrar
 * @returns {Object} Configuración para UsersTable compactConfig
 */
export function createCompactRowConfig({ showRole, canManage, roleFilter }) {
    return {
        render: (user, { t, c, attColor, roleVariant }) => (
            <>
                <View style={{ 
                    flex: 1, 
                    flexDirection: "row", 
                    alignItems: "center", 
                    gap: LAYOUT.avatarGap 
                }}>
                    <Avatar name={user.name} size={LAYOUT.avatarSize} />
                    <View style={{ flexShrink: 1 }}>
                        <Text 
                            numberOfLines={1} 
                            style={{ fontWeight: "600", fontSize: 14, color: c.text.primary }}
                        >
                            {user.name}
                        </Text>
                        <Text 
                            numberOfLines={1} 
                            style={{ fontSize: 12, color: c.text.secondary }}
                        >
                            {user.code}
                        </Text>
                    </View>
                </View>

                <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {showRole && (
                        <Badge variant={roleVariant}>
                            {t(user.typeLabelKey || "Usuario")}
                        </Badge>
                    )}
                    
                    {/* Mostrar asistencia solo si no es filtro de admin */}
                    {roleFilter !== "admin" && (
                        <Text style={{ fontSize: 12, fontWeight: "700", color: attColor }}>
                            {user.attendance || 0}%
                        </Text>
                    )}
                    
                    {/* Mostrar biometría solo si no es filtro de admin y tiene permisos */}
                    {canManage && roleFilter !== "admin" && (() => {
                        // Calcular estado basado en facial y huella
                        const hasFacial = user.hasFacial || false;
                        const hasFingerprint = user.hasFingerprint || false;
                        
                        let biometricStatus = "pending";
                        if (hasFacial && hasFingerprint) {
                            biometricStatus = "registered";
                        } else if (hasFacial || hasFingerprint) {
                            biometricStatus = "partial";
                        }
                        
                        const variantMap = {
                            registered: "success",
                            partial: "warning",
                            pending: "default",
                        };
                        const labelMap = {
                            registered: t("Registrado"),
                            partial: t("Parcial"),
                            pending: t("Pendiente"),
                        };
                        return (
                            <Badge variant={variantMap[biometricStatus] || "default"}>
                                {labelMap[biometricStatus] || t("Pendiente")}
                            </Badge>
                        );
                    })()}
                    
                    {/* Para administradores, mostrar solo el estado si es necesario */}
                    {roleFilter === "admin" && (
                        <Badge variant={user.status === "active" ? "success" : "default"}>
                            {user.status === "active" ? t("Activo") : t("Inactivo")}
                        </Badge>
                    )}
                </View>
            </>
        ),
    };
}
