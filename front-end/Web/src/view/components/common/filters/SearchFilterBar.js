// ============================================================
//  FaceAttend EDU — SearchFilterBar
//
//  Barra de búsqueda + filtro por columna que comparten las vistas de gestión
//  (usuarios, cursos). Totalmente controlada desde el viewmodel.
//  `children` se pinta después del selector de columna (p. ej. filtro por curso).
// ============================================================

import React from "react";
import { View, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card } from "../cards";
import { ColumnFilterDropdown } from "./ColumnFilterDropdown";
import { ContextualFilterDropdown } from "./ContextualFilterDropdown";
import { AttendanceFilterInput, AttendanceFilterBadge } from "./AttendanceFilterInput";
import { useTheme } from "../../hooks/useTheme";
import { useResponsive } from "../../hooks/useResponsive";

/**
 * @param {object} vm - ViewModel con search/setSearch y advancedFilter + setters
 * @param {Array} filterColumns - Columnas que ofrece el selector
 * @param {string} searchPlaceholder - Placeholder del buscador
 */
export function SearchFilterBar({ vm, filterColumns, searchPlaceholder, children }) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const c = theme.colors;
    const { column } = vm.advancedFilter;

    return (
        <Card padding={14}>
            <View style={{ flexDirection: isSmall ? "column" : "row", gap: 12, alignItems: "center" }}>
                <View style={{ flex: 1, minWidth: 200, position: "relative", justifyContent: "center" }}>
                    <View style={{ position: "absolute", left: 14, zIndex: 1 }}>
                        <Feather name="search" size={16} color={c.text.secondary} />
                    </View>
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
                    {column === "attendance" && (
                        <View style={{ position: "absolute", right: 12, zIndex: 1 }}>
                            <AttendanceFilterBadge
                                value={vm.advancedFilter.attendanceFilter}
                                onChange={vm.setAttendanceFilter}
                            />
                        </View>
                    )}
                </View>

                <ColumnFilterDropdown value={column} onChange={vm.setAdvancedFilterColumn} columns={filterColumns} />

                {children}

                {/* Filtro contextual: solo con columna elegida que no sea asistencia */}
                {column && column !== "attendance" && (
                    <ContextualFilterDropdown
                        columnType={column}
                        value={vm.advancedFilter.value}
                        onChange={vm.setAdvancedFilterValue}
                    />
                )}

                {column === "attendance" && (
                    <AttendanceFilterInput
                        value={vm.advancedFilter.attendanceFilter}
                        onChange={vm.setAttendanceFilter}
                    />
                )}
            </View>
        </Card>
    );
}

export default SearchFilterBar;
