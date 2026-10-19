import React, { useMemo } from "react";
import { View } from "react-native";
import { AnimatedDropdown } from "../../common/animation/AnimatedDropdown";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

/**
 * LanguageSelector - Selector de idioma
 * Usa el componente genérico AnimatedDropdown (mismo patrón que AcademicPeriodSelector)
 */
export function LanguageSelector() {
    const { language, setLanguage, supportedLanguages, isLoading, t } = useTranslation();

    // Convertir idiomas a formato de items para AnimatedDropdown
    const items = useMemo(() => {
        return supportedLanguages.map(lang => ({
            value: lang.code,
            label: lang.labelES,
            description: lang.label,
            icon: "globe",
        }));
    }, [supportedLanguages]);

    return (
        <View style={{ width: 260 }}>
            <AnimatedDropdown
                items={items}
                value={language}
                onSelect={setLanguage}
                placeholder={t("Seleccionar idioma")}
                triggerIcon="globe"
                disabled={isLoading}
                triggerHeight={52}
                maxVisible={5}
                searchable={true}
                searchPlaceholder={t("Buscar idioma…")}
            />
        </View>
    );
}