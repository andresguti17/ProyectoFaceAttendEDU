// ============================================================
//  FaceAttend EDU — UsersTable
//
//  Componente de tabla reutilizable y dinámica para usuarios.
//  
//  Características:
//  - Configuración por columnas (columns)
//  - Crece automáticamente según datos
//  - Soporte desktop/móvil (vista compacta)
//  - Filas clickeables con callback
//  - Estado vacío integrado
//  - Completamente genérica
//
//  La tabla se construye dinámicamente:
//  1. Define las columnas con su configuración (flex, align, render, visible)
//  2. Pasa los datos (users)
//  3. La tabla se renderiza automáticamente con header + filas
//
//  Para agregar una columna: añade un objeto a la prop `columns`.
// ============================================================

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
    Card, Badge, Avatar, EmptyState, useAttendanceColor,
} from "../../../components/common";
import { useTheme } from "../../../components/hooks/useTheme";
import { useResponsive } from "../../../components/hooks/useResponsive";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { Checkbox } from "../../../components/common/inputs/Checkbox";
import UsersLoadingFooter from "./UsersLoadingFooter";

// ── Constantes de layout ──────────────────────────────────

const LAYOUT = {
    rowPaddingX: 16,
    rowPaddingY: 12,
    headerPaddingY: 10,
    cellPaddingX: 14,
    avatarSize: 36,
    avatarGap: 10,
};

const SELECT_COLUMN_WIDTH = 32;

const DEFAULT_HEADER_ALIGN = "center";
const ALIGN_TO_JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" };

// ── Componentes internos de celdas ────────────────────────

function Cell({ col, align, children }) {
    return (
        <View
            style={{
                flex: col.flex,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: ALIGN_TO_JUSTIFY[align],
                paddingHorizontal: LAYOUT.cellPaddingX,
            }}
        >
            {children}
        </View>
    );
}

function BodyCell({ col, children }) {
    const offsetStyle = col.offsetX ? { transform: [{ translateX: col.offsetX }] } : null;

    if (!col.contentWidth) {
        return (
            <Cell col={col} align={col.align}>
                {offsetStyle ? <View style={offsetStyle}>{children}</View> : children}
            </Cell>
        );
    }

    return (
        <Cell col={col} align="center">
            <View
                style={[
                    {
                        width: "100%",
                        maxWidth: col.contentWidth,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: ALIGN_TO_JUSTIFY[col.align],
                    },
                    offsetStyle,
                ]}
            >
                {children}
            </View>
        </Cell>
    );
}

function HeaderCell({ col, label }) {
    const { theme } = useTheme();
    const headerAlign = col.headerAlign || DEFAULT_HEADER_ALIGN;

    return (
        <Cell col={col} align={headerAlign}>
            <Text
                numberOfLines={1}
                style={{
                    flexShrink: 1,
                    fontSize: 11,
                    fontWeight: "600",
                    color: theme.colors.text.secondary,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    textAlign: headerAlign,
                    transform: [{ translateX: col.headerOffsetX || 0 }],
                }}
            >
                {label}
            </Text>
        </Cell>
    );
}

// ── Header de tabla ───────────────────────────────────────

function TableHeader({ columns, selection, headerContext }) {
    const { t } = useTranslation();
    const { theme } = useTheme();

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: LAYOUT.headerPaddingY,
                paddingHorizontal: LAYOUT.rowPaddingX,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border.primary,
            }}
        >
            {selection && (
                <View style={{ width: SELECT_COLUMN_WIDTH }}>
                    <Checkbox
                        size="sm"
                        checked={selection.allSelected}
                        indeterminate={selection.someSelected && !selection.allSelected}
                        onToggle={selection.onToggleAll}
                        accessibilityLabel={t("Seleccionar todos los usuarios de la página")}
                    />
                </View>
            )}
            {columns.map((col) => (
                <HeaderCell
                    key={col.id}
                    col={col}
                    label={t(col.headerLabel ? col.headerLabel(headerContext) : col.label)}
                />
            ))}
        </View>
    );
}

// ── Fila de tabla (desktop / tablet) ──────────────────────

function SelectBox({ user, selection }) {
    const { t } = useTranslation();
    return (
        <View style={{ width: SELECT_COLUMN_WIDTH }}>
            <Checkbox
                size="sm"
                checked={selection.isSelected(user)}
                onToggle={() => selection.onToggle(user)}
                accessibilityLabel={`${t("Seleccionar")} ${user.name}`}
            />
        </View>
    );
}

function UserRow({ user, columns, onPress, isLast, renderContext, useAttendanceColorHook, selection }) {
    const { theme } = useTheme();
    const c = theme.colors;
    
    // Calcular attColor específico para este usuario
    const attColor = useAttendanceColorHook(user.attendance || 0);
    
    // Merge del contexto con el attColor específico
    const ctx = { ...renderContext, attColor, c };

    return (
        <TouchableOpacity
            onPress={() => onPress && onPress(user)}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: LAYOUT.rowPaddingY,
                paddingHorizontal: LAYOUT.rowPaddingX,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: c.border.primary,
            }}
            disabled={!onPress}
        >
            {selection && <SelectBox user={user} selection={selection} />}
            {columns.map((col) => (
                <BodyCell key={col.id} col={col}>
                    {col.render(user, ctx)}
                </BodyCell>
            ))}
        </TouchableOpacity>
    );
}

// ── Fila compacta (móvil) ─────────────────────────────────

function UserCompactRow({ user, onPress, isLast, compactConfig, renderContext, useAttendanceColorHook, selection }) {
    const { theme } = useTheme();
    const c = theme.colors;
    
    // Calcular attColor específico para este usuario
    const attColor = useAttendanceColorHook(user.attendance || 0);
    
    // Merge del contexto con el attColor específico
    const ctx = { ...renderContext, attColor, c };

    return (
        <TouchableOpacity
            onPress={() => onPress && onPress(user)}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: LAYOUT.rowPaddingY,
                paddingHorizontal: LAYOUT.rowPaddingX,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: c.border.primary,
            }}
            disabled={!onPress}
        >
            {selection && <SelectBox user={user} selection={selection} />}
            {/* Renderizar contenido compacto usando la configuración personalizada */}
            {compactConfig ? (
                compactConfig.render(user, ctx)
            ) : (
                // Fallback: vista compacta por defecto
                <>
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: LAYOUT.avatarGap }}>
                        <Avatar name={user.name} size={LAYOUT.avatarSize} />
                        <View style={{ flexShrink: 1 }}>
                            <Text numberOfLines={1} style={{ fontWeight: "600", fontSize: 14, color: c.text.primary }}>
                                {user.name}
                            </Text>
                            <Text numberOfLines={1} style={{ fontSize: 12, color: c.text.secondary }}>
                                {user.code}
                            </Text>
                        </View>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: attColor }}>
                            {user.attendance || 0}%
                        </Text>
                    </View>
                </>
            )}
        </TouchableOpacity>
    );
}

// ── UsersTable Component ──────────────────────────────────

/**
 * UsersTable - Tabla dinámica y reutilizable para usuarios
 * 
 * @param {Array} columns - Definición de columnas
 * @param {Array} data - Array de usuarios a mostrar
 * @param {Function} onRowPress - Callback al hacer click en una fila (opcional)
 * @param {Object} renderContext - Contexto adicional para las funciones render de columnas
 * @param {Object} visibilityContext - Contexto para las funciones visible de columnas
 * @param {Object} compactConfig - Configuración personalizada para vista móvil compacta (opcional)
 * @param {Object} emptyState - Configuración del estado vacío (icon, title, description)
 * @param {boolean} isLoading - Si está cargando más usuarios (muestra loading footer)
 * @param {string} loadingMessage - Mensaje personalizado mientras carga
 * @param {string} completeMessage - Mensaje cuando terminó de cargar
 * @param {Set} selectedIds - ids seleccionados (selección múltiple, opcional)
 * @param {Function} onSelectionChange - recibe el nuevo Set; si falta, no hay checkboxes
 * @param {Object} style - Estilos adicionales para el Card contenedor
 * 
 * @example
 * <UsersTable
 *   columns={COLUMNS}
 *   data={users}
 *   onRowPress={(user) => console.log(user)}
 *   renderContext={{ t, c, attColor, roleVariant }}
 *   visibilityContext={{ roleFilter, canManage }}
 *   isLoading={vm.isLoading}
 *   loadingMessage="Cargando estudiantes..."
 *   completeMessage="¡Ya llegaste hasta el final!"
 *   emptyState={{
 *     icon: "users",
 *     title: "Sin resultados",
 *     description: "No se encontraron usuarios"
 *   }}
 * />
 */
export default function UsersTable({
    columns,
    data,
    onRowPress,
    renderContext = {},
    visibilityContext = {},
    compactConfig,
    emptyState,
    isLoading = false,
    loadingMessage = "Cargando usuarios...",
    completeMessage = "¡Ya llegaste hasta el final de la lista, no hay más usuarios que mostrar!",
    selectedIds,
    onSelectionChange,
    style,
}) {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const useAttendanceColorHook = useAttendanceColor;

    // Selección múltiple: solo si el padre entrega onSelectionChange. El
    // "seleccionar todos" del header actúa sobre las filas visibles (página).
    const selection = useMemo(() => {
        if (!onSelectionChange) return null;
        const ids = selectedIds ?? new Set();
        const pageIds = data.map((u) => u.id);
        const selectedOnPage = pageIds.filter((id) => ids.has(id)).length;
        return {
            isSelected: (u) => ids.has(u.id),
            allSelected: pageIds.length > 0 && selectedOnPage === pageIds.length,
            someSelected: selectedOnPage > 0,
            onToggle: (u) => {
                const next = new Set(ids);
                if (next.has(u.id)) next.delete(u.id);
                else next.add(u.id);
                onSelectionChange(next);
            },
            onToggleAll: (checked) => {
                const next = new Set(ids);
                pageIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
                onSelectionChange(next);
            },
        };
    }, [data, selectedIds, onSelectionChange]);

    // Calcular columnas visibles según contexto
    const visibleColumns = useMemo(() => {
        return columns.filter((col) => (col.visible ? col.visible(visibilityContext) : true));
    }, [columns, visibilityContext]);

    // Estado vacío por defecto
    const defaultEmptyState = {
        icon: "users",
        title: t("Sin resultados"),
        description: t("No se encontraron usuarios"),
    };

    const emptyConfig = emptyState || defaultEmptyState;

    return (
        <Card padding={0} style={style}>
            {/* Header (solo desktop) */}
            {!isSmall && (
                <TableHeader columns={visibleColumns} selection={selection} headerContext={renderContext} />
            )}

            {/* Contenido */}
            {data.length === 0 && !isLoading ? (
                // Estado vacío (sin datos y sin carga)
                <EmptyState
                    icon={<Feather name={emptyConfig.icon} size={40} color={c.text.secondary} />}
                    title={emptyConfig.title}
                    description={emptyConfig.description}
                />
            ) : (
                <>
                    {/* Filas de usuarios */}
                    {data.map((user, i) => {
                        const isLast = i === data.length - 1;

                        return isSmall ? (
                            <UserCompactRow
                                key={user.id}
                                user={user}
                                onPress={onRowPress}
                                isLast={false} // Footer siempre muestra borde superior
                                compactConfig={compactConfig}
                                renderContext={renderContext}
                                useAttendanceColorHook={useAttendanceColorHook}
                                selection={selection}
                            />
                        ) : (
                            <UserRow
                                key={user.id}
                                user={user}
                                columns={visibleColumns}
                                onPress={onRowPress}
                                isLast={false} // Footer siempre muestra borde superior
                                renderContext={renderContext}
                                useAttendanceColorHook={useAttendanceColorHook}
                                selection={selection}
                            />
                        );
                    })}
                    
                    {/* Footer persistente - Siempre visible cuando hay datos */}
                    <UsersLoadingFooter 
                        isLoading={isLoading}
                        loadingMessage={loadingMessage}
                        completeMessage={completeMessage}
                    />
                </>
            )}
        </Card>
    );
}
