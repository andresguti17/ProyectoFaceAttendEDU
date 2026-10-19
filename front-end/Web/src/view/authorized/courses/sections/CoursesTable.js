// ============================================================
//  FaceAttend EDU — CoursesTable
//
//  Componente de tabla reutilizable y dinámica para cursos.
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
//  2. Pasa los datos (courses)
//  3. La tabla se renderiza automáticamente con header + filas
//
//  Para agregar una columna: añade un objeto a la prop `columns`.
// ============================================================

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card, EmptyState } from "../../../components/common";
import { useTheme } from "../../../components/hooks/useTheme";
import { useResponsive } from "../../../components/hooks/useResponsive";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import CoursesLoadingFooter from "./CoursesLoadingFooter";

// ── Constantes de layout ──────────────────────────────────

const LAYOUT = {
    rowPaddingX: 16,
    rowPaddingY: 12,
    headerPaddingY: 10,
    cellPaddingX: 14,
};

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

function TableHeader({ columns }) {
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
            {columns.map((col) => (
                <HeaderCell key={col.id} col={col} label={t(col.label)} />
            ))}
        </View>
    );
}

// ── Fila de tabla (desktop / tablet) ──────────────────────

function CourseRow({ course, columns, onPress, isLast, renderContext }) {
    const { theme } = useTheme();
    const c = theme.colors;
    
    // Merge del contexto con el c específico
    const ctx = { ...renderContext, c };

    return (
        <TouchableOpacity
            onPress={() => onPress && onPress(course)}
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
            {columns.map((col) => (
                <BodyCell key={col.id} col={col}>
                    {col.render(course, ctx)}
                </BodyCell>
            ))}
        </TouchableOpacity>
    );
}

// ── Fila compacta (móvil) ─────────────────────────────────

function CourseCompactRow({ course, onPress, isLast, compactConfig, renderContext }) {
    const { theme } = useTheme();
    const c = theme.colors;
    
    // Merge del contexto con el c específico
    const ctx = { ...renderContext, c };

    return (
        <TouchableOpacity
            onPress={() => onPress && onPress(course)}
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
            {/* Renderizar contenido compacto usando la configuración personalizada */}
            {compactConfig ? (
                compactConfig.render(course, ctx)
            ) : (
                // Fallback: vista compacta por defecto
                <>
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View
                            style={{
                                width: 3,
                                height: 36,
                                backgroundColor: course.color || "#666",
                                borderRadius: 2,
                            }}
                        />
                        <View style={{ flexShrink: 1 }}>
                            <Text numberOfLines={1} style={{ fontWeight: "700", fontSize: 12, color: course.color || c.brand.primary }}>
                                {course.code}
                            </Text>
                            <Text numberOfLines={1} style={{ fontWeight: "600", fontSize: 14, color: c.text.primary }}>
                                {course.name}
                            </Text>
                        </View>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: c.text.primary }}>
                            {course.students || 0} est.
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: c.brand.primary }}>
                            {course.avgAttendance || 0}%
                        </Text>
                    </View>
                </>
            )}
        </TouchableOpacity>
    );
}

// ── CoursesTable Component ────────────────────────────────

/**
 * CoursesTable - Tabla dinámica y reutilizable para cursos
 * 
 * @param {Array} columns - Definición de columnas
 * @param {Array} data - Array de cursos a mostrar
 * @param {Function} onRowPress - Callback al hacer click en una fila (opcional)
 * @param {Object} renderContext - Contexto adicional para las funciones render de columnas
 * @param {Object} visibilityContext - Contexto para las funciones visible de columnas
 * @param {Object} compactConfig - Configuración personalizada para vista móvil compacta (opcional)
 * @param {Object} emptyState - Configuración del estado vacío (icon, title, description)
 * @param {boolean} isLoading - Si está cargando más cursos (muestra loading footer)
 * @param {string} loadingMessage - Mensaje personalizado mientras carga
 * @param {string} completeMessage - Mensaje cuando terminó de cargar
 * @param {Object} style - Estilos adicionales para el Card contenedor
 * 
 * @example
 * <CoursesTable
 *   columns={COLUMNS}
 *   data={courses}
 *   onRowPress={(course) => console.log(course)}
 *   renderContext={{ t, c }}
 *   visibilityContext={{ isDesktop }}
 *   isLoading={vm.isLoading}
 *   loadingMessage="Cargando cursos..."
 *   completeMessage="¡Ya llegaste hasta el final!"
 *   emptyState={{
 *     icon: "book-open",
 *     title: "Sin resultados",
 *     description: "No se encontraron cursos"
 *   }}
 * />
 */
export default function CoursesTable({
    columns,
    data,
    onRowPress,
    renderContext = {},
    visibilityContext = {},
    compactConfig,
    emptyState,
    isLoading = false,
    loadingMessage = "Cargando cursos...",
    completeMessage = "¡Ya llegaste hasta el final de la lista, no hay más cursos que mostrar!",
    style,
}) {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    // Calcular columnas visibles según contexto
    const visibleColumns = useMemo(() => {
        return columns.filter((col) => (col.visible ? col.visible(visibilityContext) : true));
    }, [columns, visibilityContext]);

    // Estado vacío por defecto
    const defaultEmptyState = {
        icon: "book-open",
        title: t("Sin resultados"),
        description: t("No se encontraron cursos"),
    };

    const emptyConfig = emptyState || defaultEmptyState;

    return (
        <Card padding={0} style={style}>
            {/* Header (solo desktop) */}
            {!isSmall && <TableHeader columns={visibleColumns} />}

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
                    {/* Filas de cursos */}
                    {data.map((course, i) => {
                        const isLast = i === data.length - 1;

                        return isSmall ? (
                            <CourseCompactRow
                                key={course.id}
                                course={course}
                                onPress={onRowPress}
                                isLast={false} // Footer siempre muestra borde superior
                                compactConfig={compactConfig}
                                renderContext={renderContext}
                            />
                        ) : (
                            <CourseRow
                                key={course.id}
                                course={course}
                                columns={visibleColumns}
                                onPress={onRowPress}
                                isLast={false} // Footer siempre muestra borde superior
                                renderContext={renderContext}
                            />
                        );
                    })}
                    
                    {/* Footer persistente - Siempre visible cuando hay datos */}
                    <CoursesLoadingFooter 
                        isLoading={isLoading}
                        loadingMessage={loadingMessage}
                        completeMessage={completeMessage}
                    />
                </>
            )}
        </Card>
    );
}
