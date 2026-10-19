// ============================================================
//  InstructorAutocomplete — Autocompletado para instructores
//  Refactorizado para usar AnimatedDropdown (evitar DRY)
// ============================================================

import React, { useMemo } from "react";
import { AnimatedDropdown } from "../common";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";

/**
 * Campo de autocompletado para buscar y seleccionar instructores
 * Usa AnimatedDropdown con búsqueda integrada
 * 
 * @param {string} instructorId - ID del instructor seleccionado
 * @param {function} onSelect - Callback al seleccionar un instructor
 * @param {function} searchFn - Función de búsqueda que retorna resultados
 * @param {boolean} error - Si hay error de validación
 */
export function InstructorAutocomplete({ instructorId, onSelect, searchFn, error }) {
    const { t } = useTranslation();
    
    // Obtener todos los instructores disponibles
    const allInstructors = useMemo(() => searchFn(""), [searchFn]);
    
    // Transformar instructores a formato de AnimatedDropdown
    const instructorItems = useMemo(() => {
        return allInstructors.map(user => ({
            value: user.id,
            label: user.name,
            description: `${user.department ?? user.email} • ${user.role === "admin" ? t("Admin") : t("Docente")}`,
            icon: "user",
            // Datos adicionales para el callback onSelect
            _raw: user,
        }));
    }, [allInstructors, t]);

    return (
        <AnimatedDropdown
            items={instructorItems}
            value={instructorId || ""} // Usar directamente el ID
            onSelect={(selectedId) => {
                const selectedItem = instructorItems.find(item => item.value === selectedId);
                if (selectedItem && selectedItem._raw) {
                    onSelect(selectedItem._raw);
                }
            }}
            placeholder={t("Buscar instructor por nombre...")}
            triggerIcon="search"
            searchable={true}
            searchPlaceholder={t("Buscar instructor...")}
            maxVisible={5}
            triggerHeight={48}
            error={error}
            style={{ marginBottom: 0 }}
        />
    );
}

export default InstructorAutocomplete;
