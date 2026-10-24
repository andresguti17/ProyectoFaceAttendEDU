// ============================================================
//  FaceAttend EDU — LanguageContext (i18n · Context)
//
//  Fachada sobre i18next (ADR-017). Conserva la API previa para que
//  las vistas no cambien:
//    const { t, language, setLanguage, isLoading } = useLanguageContext();
// ============================================================

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useTranslation as useI18next } from "react-i18next";

import i18n from "../../../../locales";
import { LanguageStorage } from "../storage/LanguageStorage";
import { DEFAULT_LANGUAGE, findLanguage } from "../constants/SupportedLanguages";

// ── Context ───────────────────────────────────────────────────────────────

const LanguageContext = createContext({
    language: DEFAULT_LANGUAGE,
    setLanguage: async () => {},
    t: (text) => text,
    isLoading: true,
});

// ── Provider ──────────────────────────────────────────────────────────────

export function LanguageProvider({ children }) {
    const { t: i18nT, i18n: instance } = useI18next();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const saved = await LanguageStorage.load();
            if (cancelled) return;
            // Idioma guardado de una versión anterior (p. ej. "de") → por defecto.
            await instance.changeLanguage(findLanguage(saved) ? saved : DEFAULT_LANGUAGE);
            setIsLoading(false);
        })();
        return () => { cancelled = true; };
    }, [instance]);

    const language = instance.resolvedLanguage || instance.language || DEFAULT_LANGUAGE;

    const setLanguage = useCallback(async (code) => {
        if (!findLanguage(code) || code === instance.language) return;
        await instance.changeLanguage(code);
        await LanguageStorage.save(code);
    }, [instance]);

    // shortcut: los literales vacíos o no-string se devuelven tal cual, como antes.
    const t = useCallback((text, options) => {
        if (!text || typeof text !== "string") return text;
        return i18nT(text, options);
    }, [i18nT]);

    const value = useMemo(
        () => ({ language, setLanguage, t, isLoading }),
        [language, setLanguage, t, isLoading],
    );

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

// ── Hook de acceso al contexto ────────────────────────────────────────────

export function useLanguageContext() {
    return useContext(LanguageContext);
}

export { LanguageContext, i18n };
