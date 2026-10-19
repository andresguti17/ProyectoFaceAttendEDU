import React, { useMemo } from "react";
import { View } from "react-native";
import { AnimatedDropdown } from "../animation";

/**
 * ContextualFilterDropdown - Dropdown inteligente que cambia opciones según contexto
 * 
 * Segundo nivel del sistema de filtrado. Las opciones disponibles cambian
 * dinámicamente según la columna seleccionada en el primer dropdown.
 * 
 * Contextos soportados:
 * - name/program: Ninguno, A→Z, Z→A
 * - status: Activo, Inactivo
 * - attendance: Se maneja con AttendanceFilterInput (no usa este componente)
 * 
 * @param {string} columnType - Tipo de columna: "name" | "program" | "status"
 * @param {string} value - Valor del filtro seleccionado
 * @param {function} onChange - Callback cuando cambia: (filterValue) => void
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * <ContextualFilterDropdown
 *   columnType="name"
 *   value={filterValue}
 *   onChange={setFilterValue}
 * />
 */
export function ContextualFilterDropdown({
    columnType,
    value,
    onChange,
    style,
}) {
    // Generar opciones según el tipo de columna
    const items = useMemo(() => {
        switch (columnType) {
            case "name":
            case "program":
                return [
                    { value: null, label: "Ninguno", icon: "minus" },
                    { value: "asc", label: "A → Z", icon: "arrow-down" },
                    { value: "desc", label: "Z → A", icon: "arrow-up" },
                ];
            
            case "status":
                return [
                    { value: "active", label: "Activo", icon: "check-circle" },
                    { value: "inactive", label: "Inactivo", icon: "x-circle" },
                ];
            
            default:
                return [];
        }
    }, [columnType]);

    // Si no hay opciones (ej: attendance usa otro componente), no renderizar nada
    if (items.length === 0) {
        return null;
    }

    return (
        <AnimatedDropdown
            value={value}
            onSelect={onChange}
            items={items}
            placeholder={columnType === "name" || columnType === "program" ? "Ninguno" : "--"}
            triggerIcon="filter"
            style={[{ alignSelf: "flex-start", minWidth: 140 }, style]}
            triggerHeight={48}
        />
    );
}

export default ContextualFilterDropdown;
