// ============================================================
//  FaceAttend EDU — SupportedLanguages (i18n · Constants)
//
//  Español es el idioma fuente de la aplicación.
//  Las traducciones se obtienen dinámicamente del microservicio
//  fae-translation-service mediante RestTranslationProvider.
//
//  Para AGREGAR un idioma:
//    1. Añadir entrada en SUPPORTED_LANGUAGES con code, label, labelES y flag
//    2. El sistema creará automáticamente el JSON correspondiente
//       cuando se soliciten traducciones para ese idioma
//
//  Idiomas activos:
//    - Español (es): idioma fuente, sin traducciones necesarias
//    - Inglés (en): traducciones dinámicas ES→EN
//    - Francés (fr): traducciones dinámicas ES→FR
//    - Alemán (de): traducciones dinámicas ES→DE
//    - Portugués (pt): traducciones dinámicas ES→PT
// ============================================================

export const SUPPORTED_LANGUAGES = [
    { code: "es", label: "Español",   labelES: "Español",   flag: "🇪🇸" },
    { code: "en", label: "English",   labelES: "Inglés",    flag: "🇺🇸" },
    { code: "fr", label: "Français",  labelES: "Francés",   flag: "🇫🇷" },
    { code: "de", label: "Deutsch",   labelES: "Alemán",    flag: "🇩🇪" },
    { code: "pt", label: "Português", labelES: "Portugués", flag: "🇧🇷" },

    // ── Idiomas para fase de producción (requieren JSON o LibreTranslate) ──
    //
    // { code: "it", label: "Italiano",  labelES: "Italiano",  flag: "🇮🇹" },
    // { code: "ja", label: "日本語",    labelES: "Japonés",   flag: "🇯🇵" },
    // { code: "ko", label: "한국어",    labelES: "Coreano",   flag: "🇰🇷" },
    // { code: "zh", label: "中文",      labelES: "Chino",     flag: "🇨🇳" },
];

/** Idioma fuente de la aplicación. Siempre español. */
export const SOURCE_LANGUAGE = "es";

/** Idioma por defecto al iniciar si no hay preferencia guardada. */
export const DEFAULT_LANGUAGE = "es";

/** Lookup rápido por código */
export function findLanguage(code) {
    return SUPPORTED_LANGUAGES.find(l => l.code === code);
}
