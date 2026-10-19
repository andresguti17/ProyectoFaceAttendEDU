// ============================================================
//  FaceAttend EDU — UsersFilterBar
//
//  Barra de filtros reutilizable para la gestión de usuarios.
//  
//  Incluye:
//  - Buscador por nombre/código
//  - Selector de columna a filtrar
//  - Filtros contextuales (nombre, programa, estado)
//  - Filtro especializado de asistencia con badge
//
//  Diseñado para ser usado por AdminUsers, TeacherUsers, StudentUsers.
//  Totalmente controlado desde el viewmodel - no tiene estado interno.
// ============================================================

import React, { useMemo } from "react";
import { View, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card, Select } from "../../../components/common";
import {
    ColumnFilterDropdown,
    ContextualFilterDropdown,
    AttendanceFilterInput,
    AttendanceFilterBadge,
} from "../../../components/common/filters";
import { useTheme } from "../../../components/hooks/useTheme";
import { useResponsive } from "../../../components/hooks/useResponsive";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

/**
 * UsersFilterBar - Barra de filtros reutilizable para gestión de usuarios
 * 
 * @param {object} vm - ViewModel de usuarios (useUsersViewModel)
 * @param {object} options - Opciones de configuración
 * @param {Array} options.filterColumns - Columnas disponibles para filtrar (opcional, usa default si no se pasa)
 * @param {string} options.searchPlaceholder - Placeholder del buscador (opcional)
 * @param {boolean} options.showCourseFilter - Muestra el selector de curso (opcional)
 * 
 * @example
 * <UsersFilterBar 
 *   vm={vm} 
 *   options={{
 *     searchPlaceholder: "Buscar estudiante...",
 *     filterColumns: [
 *       { key: "name", label: "Nombre", icon: "type" },
 *       { key: "attendance", label: "Asistencia", icon: "percent" },
 *     ]
 *   }}
 * />
 */
export default function UsersFilterBar({ vm, options = {} }) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const { t } = useTranslation();
    const c = theme.colors;

    // Configuración de columnas para el filtro (con defaults)
    const filterColumns = useMemo(() => {
        if (options.filterColumns) {
            return options.filterColumns;
        }
        
        // Configuración por defecto
        return [
            { key: "name", label: t("Nombre"), icon: "type" },
            { key: "program", label: t("Programa"), icon: "book" },
            { key: "attendance", label: t("Asistencia"), icon: "percent" },
            { key: "status", label: t("Estado"), icon: "activity" },
        ];
    }, [options.filterColumns, t]);

    const searchPlaceholder = options.searchPlaceholder || t("Buscar por nombre o código...");

    return (
        <Card padding={14}>
            <View style={{ 
                flexDirection: isSmall ? "column" : "row", 
                gap: 12, 
                alignItems: "center" 
            }}>
                {/* Buscador */}
                <View style={{ 
                    flex: 1, 
                    minWidth: 200, 
                    position: "relative", 
                    justifyContent: "center" 
                }}>
                    {/* Icono de búsqueda */}
                    <View style={{ position: "absolute", left: 14, zIndex: 1 }}>
                        <Feather name="search" size={16} color={c.text.secondary} />
                    </View>
                    
                    {/* Input de búsqueda */}
                    <TextInput
                        placeholder={searchPlaceholder}
                        value={vm.search}
                        onChangeText={vm.setSearch}
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
                    
                    {/* Badge de filtro activo de asistencia */}
                    {vm.advancedFilter.column === "attendance" && (
                        <View style={{ position: "absolute", right: 12, zIndex: 1 }}>
                            <AttendanceFilterBadge
                                value={vm.advancedFilter.attendanceFilter}
                                onChange={vm.setAttendanceFilter}
                            />
                        </View>
                    )}
                </View>

                {/* Selector de columna a filtrar */}
                <ColumnFilterDropdown
                    value={vm.advancedFilter.column}
                    onChange={vm.setAdvancedFilterColumn}
                    columns={filterColumns}
                />

                {/* Filtro por curso (opt-in: lo pide cada vista vía options) */}
                {options.showCourseFilter && (vm.courseOptions?.length ?? 0) > 0 && (
                    <Select
                        value={vm.courseFilter}
                        onValueChange={vm.setCourseFilter}
                        options={vm.courseOptions}
                        placeholder={t("Todos los cursos")}
                        style={{ minWidth: 180 }}
                        searchable
                    />
                )}

                {/* Filtro contextual (aparece solo si hay columna seleccionada y no es attendance) */}
                {vm.advancedFilter.column && vm.advancedFilter.column !== "attendance" && (
                    <ContextualFilterDropdown
                        columnType={vm.advancedFilter.column}
                        value={vm.advancedFilter.value}
                        onChange={vm.setAdvancedFilterValue}
                    />
                )}

                {/* Filtro especializado de asistencia */}
                {vm.advancedFilter.column === "attendance" && (
                    <AttendanceFilterInput
                        value={vm.advancedFilter.attendanceFilter}
                        onChange={vm.setAttendanceFilter}
                    />
                )}
            </View>
        </Card>
    );
}
