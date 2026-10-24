// ============================================================
//  FaceAttend EDU — SupportedLanguages (i18n · Constants)
//
//  Español es el idioma fuente de la aplicación. Las traducciones son
//  JSON estáticos de i18next en src/locales (ADR-017).
//
//  Para AGREGAR un idioma:
//    1. Crear src/locales/<code>.json y registrarlo en src/locales/index.js
//    2. Añadir entrada en SUPPORTED_LANGUAGES con code, label, labelES y flag
// ============================================================

export const SUPPORTED_LANGUAGES = [
    { code: "es", label: "Español",   labelES: "Español",   flag: "🇪🇸" },
    { code: "en", label: "English",   labelES: "Inglés",    flag: "🇺🇸" },
    { code: "pt", label: "Português", labelES: "Portugués", flag: "🇧🇷" },
    { code: "fr", label: "Français",  labelES: "Francés",   flag: "🇫🇷" },
];

/** Idioma fuente de la aplicación. Siempre español. */
export const SOURCE_LANGUAGE = "es";

/** Idioma por defecto al iniciar si no hay preferencia guardada. */
export const DEFAULT_LANGUAGE = "es";

/** Lookup rápido por código */
export function findLanguage(code) {
    return SUPPORTED_LANGUAGES.find(l => l.code === code);
}
