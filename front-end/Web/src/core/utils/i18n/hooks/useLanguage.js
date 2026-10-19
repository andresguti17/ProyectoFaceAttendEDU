// ============================================================
//  useLanguage - Hook simplificado para manejo de idioma
// ============================================================

import { useLanguageContext } from "../context/LanguageContext";

/**
 * Hook simplificado que expone funciones para cambiar idioma
 * @returns {Object} - { currentLanguage, setLanguage, isLoading }
 */
export function useLanguage() {
    const { language, setLanguage, isLoading } = useLanguageContext();

    return {
        currentLanguage: language,
        setLanguage,
        isLoading,
    };
}
