// ============================================================
//  FaceAttend EDU — UserFilters (Componente Genérico Reutilizable)
//
//  Componente de filtros para usuarios que encapsula:
//  - Búsqueda por texto (nombre, código, email)
//  - Filtro por tipo de usuario
//  - Filtro por curso/programa
//  - Filtro por estado
//
//  Uso:
//  <UserFilters
//    search={vm.search}
//    onSearchChange={vm.setSearch}
//    userTypeFilter={vm.userTypeFilter}
//    userTypeFilters={vm.userTypeFilters}
//    onUserTypeChange={vm.setUserTypeFilter}
//    courseFilter={vm.courseFilter}
//    courses={vm.courses}
//    onCourseChange={vm.setCourseFilter}
//    statusFilter={vm.statusFilter}
//    statusFilters={vm.statusFilters}
//    onStatusChange={vm.setStatusFilter}
//    showUserTypeFilter={true}
//    showCourseFilter={true}
//    showStatusFilter={true}
//  />
// ============================================================

import React from "react";
import { View, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card, AnimatedDropdown } from "../index";
import { useTheme } from "../../hooks/useTheme";
import { useResponsive } from "../../hooks/useResponsive";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

/**
 * Componente de filtros reutilizable para usuarios
 * 
 * @param {string} search - Texto de búsqueda
 * @param {function} onSearchChange - Callback al cambiar búsqueda
 * @param {string} searchPlaceholder - Placeholder personalizado para búsqueda
 * @param {string} userTypeFilter - Valor seleccionado de tipo de usuario
 * @param {Array} userTypeFilters - Items disponibles para filtro de tipo
 * @param {function} onUserTypeChange - Callback al cambiar tipo de usuario
 * @param {string} courseFilter - Valor seleccionado de curso
 * @param {Array} courses - Items disponibles para filtro de curso
 * @param {function} onCourseChange - Callback al cambiar curso
 * @param {string} statusFilter - Valor seleccionado de estado
 * @param {Array} statusFilters - Items disponibles para filtro de estado
 * @param {function} onStatusChange - Callback al cambiar estado
 * @param {boolean} showUserTypeFilter - Si muestra filtro de tipo de usuario
 * @param {boolean} showCourseFilter - Si muestra filtro de curso
 * @param {boolean} showStatusFilter - Si muestra filtro de estado
 * @param {object} style - Estilos adicionales
 */
export function UserFilters({
    search,
    onSearchChange,
    searchPlaceholder,
    userTypeFilter,
    userTypeFilters,
    onUserTypeChange,
    courseFilter,
    courses,
    onCourseChange,
    statusFilter,
    statusFilters,
    onStatusChange,
    sortFilter,
    sortFilters,
    onSortChange,
    showUserTypeFilter = true,
    showCourseFilter = true,
    showStatusFilter = true,
    showSortFilter = false,
    style,
}) {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    return (
        <Card padding={14} style={style}>
            <View style={{ flexDirection: isSmall ? "column" : "row", gap: 12, flexWrap: "wrap" }}>
                {/* Búsqueda */}
                <View style={{ flex: 1, minWidth: 200, position: "relative", justifyContent: "center" }}>
                    <View style={{ position: "absolute", left: 14, zIndex: 1 }}>
                        <Feather name="search" size={16} color={c.text.secondary} />
                    </View>
                    <TextInput
                        placeholder={searchPlaceholder || t("Buscar por nombre, código o email...")}
                        value={search}
                        onChangeText={onSearchChange}
                        style={{
                            height: 48,
                            borderWidth: 1.5,
                            borderColor: c.border.primary,
                            borderRadius: 14,
                            paddingLeft: 40,
                            paddingRight: 14,
                            fontSize: 14,
                            backgroundColor: c.background.surface,
                            color: c.text.primary,
                        }}
                        placeholderTextColor={c.text.disabled}
                    />
                </View>

                {/* Filtro por tipo de usuario */}
                {showUserTypeFilter && userTypeFilters && userTypeFilters.length > 0 && (
                    <AnimatedDropdown
                        items={userTypeFilters}
                        value={userTypeFilter}
                        onSelect={onUserTypeChange}
                        triggerIcon="filter"
                        style={{ minWidth: 180 }}
                    />
                )}

                {/* Filtro por curso */}
                {showCourseFilter && courses && courses.length > 0 && (
                    <AnimatedDropdown
                        items={[
                            { value: "", label: t("Todos los programas"), icon: "layers" },
                            ...courses,
                        ]}
                        value={courseFilter}
                        onSelect={onCourseChange}
                        triggerIcon="book-open"
                        style={{ minWidth: 200 }}
                    />
                )}

                {/* Filtro por estado */}
                {showStatusFilter && statusFilters && statusFilters.length > 0 && (
                    <AnimatedDropdown
                        items={statusFilters}
                        value={statusFilter}
                        onSelect={onStatusChange}
                        triggerIcon="activity"
                        style={{ minWidth: 180 }}
                    />
                )}

                {/* Orden por asistencia */}
                {showSortFilter && sortFilters && sortFilters.length > 0 && (
                    <AnimatedDropdown
                        items={sortFilters}
                        value={sortFilter}
                        onSelect={onSortChange}
                        triggerIcon="trending-down"
                        style={{ minWidth: 200 }}
                    />
                )}
            </View>
        </Card>
    );
}

export default UserFilters;
