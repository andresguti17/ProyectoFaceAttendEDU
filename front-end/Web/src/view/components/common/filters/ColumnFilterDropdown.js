import React from "react";
import { View } from "react-native";
import { AnimatedDropdown } from "../animation";

/**
 * ColumnFilterDropdown - Dropdown para seleccionar qué columna filtrar
 * 
 * Primer nivel del sistema de filtrado avanzado. Permite al usuario elegir
 * qué columna desea filtrar (Rol, Nombre, Programa, Asistencia, Estado).
 * 
 * @param {string} value - Columna seleccionada actualmente
 * @param {function} onChange - Callback cuando cambia la selección: (columnKey) => void
 * @param {Array} columns - Array de columnas disponibles con estructura: { key, label, icon? }
 * @param {string} placeholder - Texto cuando no hay selección (default: "Filtrar por...")
 * @param {object} style - Estilos adicionales del contenedor
 * 
 * @example
 * <ColumnFilterDropdown
 *   value={selectedColumn}
 *   onChange={setSelectedColumn}
 *   columns={[
 *     { key: "role", label: "Rol", icon: "user" },
 *     { key: "name", label: "Nombre", icon: "type" },
 *     { key: "program", label: "Programa", icon: "book" },
 *     { key: "attendance", label: "Asistencia", icon: "percent" },
 *     { key: "status", label: "Estado", icon: "activity" }
 *   ]}
 * />
 */
export function ColumnFilterDropdown({
    value,
    onChange,
    columns = [],
    placeholder = "Sin filtro",
    style,
}) {
    // Transformar columns a formato de AnimatedDropdown
    const items = columns.map(col => ({
        value: col.key,
        label: col.label,
        icon: col.icon,
    }));

    // Agregar opción "Ninguno" al inicio
    const allItems = [
        { value: null, label: placeholder, icon: "filter" },
        ...items,
    ];

    return (
        <AnimatedDropdown
            value={value}
            onSelect={onChange}
            items={allItems}
            placeholder={placeholder}
            triggerIcon="columns"
            style={[{ alignSelf: "flex-start", minWidth: 120 }, style]}
            triggerHeight={48}
        />
    );
}

export default ColumnFilterDropdown;
