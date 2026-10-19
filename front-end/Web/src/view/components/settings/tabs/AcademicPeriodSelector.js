import React, { useMemo } from "react";
import { AnimatedDropdown } from "../../common/animation/AnimatedDropdown";
import { ACADEMIC_PERIOD_CONFIG } from "../../../../core/constants/academicPeriods";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

/**
 * AcademicPeriodSelector - Selector de tipo de período académico
 * Usa el componente genérico AnimatedDropdown
 * 
 * @param {string} value - Tipo de período seleccionado (annual, semestral, quarterly, trimestral)
 * @param {function} onChange - Callback cuando cambia la selección
 */
export function AcademicPeriodSelector({ value, onChange }) {
    const { t } = useTranslation();

    // Convertir la configuración a formato de items para AnimatedDropdown
    const items = useMemo(() => {
        return Object.entries(ACADEMIC_PERIOD_CONFIG).map(([key, config]) => ({
            value: key,
            label: t(config.labelKey),
            description: `${config.defaultWeeks} ${t("semanas")} • ${t(config.descriptionKey)}`,
            icon: "calendar",
        }));
    }, [t]);

    return (
        <AnimatedDropdown
            items={items}
            value={value}
            onSelect={onChange}
            placeholder={t("Seleccionar período")}
            triggerIcon="calendar"
            triggerHeight={40}
            maxVisible={4}
        />
    );
}
