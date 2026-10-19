// ============================================================
//  FaceAttend EDU — useTranslation (i18n · Hook)
//
//  Hook público de internacionalización.
//
//  Uso básico:
//    const { t, language, setLanguage } = useTranslation();
//    {t("Inicio de sesión")}
//    {t("Guardar")}
// ============================================================

import { useLanguageContext } from "../context/LanguageContext";
import { SUPPORTED_LANGUAGES, findLanguage } from "../constants/SupportedLanguages";

export function useTranslation() {
    const { 
        t, 
        language, 
        setLanguage, 
        isLoading,
    } = useLanguageContext();

    return {
        t,
        language,
        setLanguage,
        currentLanguage: findLanguage(language),
        supportedLanguages: SUPPORTED_LANGUAGES,
        isLoading,
    };
}
