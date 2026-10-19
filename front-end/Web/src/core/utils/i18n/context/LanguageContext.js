// ============================================================
//  FaceAttend EDU — LanguageContext (i18n · Context)
//
//  Context de traducción con LoadingView como flujo alternativo.
//
//  FLUJO AL CAMBIAR IDIOMA:
//    1. isPreparingTranslations = true → LoadingView aparece
//    2. Preparar TODAS las traducciones necesarias
//    3. Aplicar cambio de idioma
//    4. isPreparingTranslations = false → View normal
//
//  API pública:
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

import { translationService } from "../services/TranslationService";
import { LanguageStorage } from "../storage/LanguageStorage";
import { SOURCE_LANGUAGE, DEFAULT_LANGUAGE } from "../constants/SupportedLanguages";

// ── Context ───────────────────────────────────────────────────────────────

const LanguageContext = createContext({
    language: DEFAULT_LANGUAGE,
    setLanguage: async () => {},
    t: (text) => text,
    isLoading: true,
    isPreparingTranslations: false,
});

// ── Provider ──────────────────────────────────────────────────────────────

export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
    const [isLoading, setIsLoading] = useState(true);
    const [isPreparingTranslations, setIsPreparingTranslations] = useState(false);

    // ── Inicialización ───────────────────────────────────────────────

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const saved = await LanguageStorage.load();
            if (cancelled) return;

            // Hidratar traducciones si el idioma no es español
            if (saved !== SOURCE_LANGUAGE) {
                await translationService.hydrate(saved);
            }

            setLanguageState(saved);
            setIsLoading(false);
        })();

        // Cleanup al desmontar
        return () => { 
            cancelled = true;
            translationService.cleanup();
        };
    }, []);

    // ── Verificar y preparar traducciones de View actual ──────────────

    const checkAndPrepareTranslations = useCallback(async () => {
        // Solo verificar si ya cargó y no es español
        if (isLoading || language === SOURCE_LANGUAGE) return;
        
        // Usar requestAnimationFrame para esperar al próximo frame (después del render)
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const activeTexts = translationService.getActiveTexts();
        
        if (activeTexts.length === 0) {
            // Si no hay textos activos, simplemente resetear para la próxima View
            translationService.clearTracking();
            return;
        }
        
        // Verificar cuántos textos faltan traducir
        const missing = activeTexts.filter(text => {
            const cached = translationService.getCached(text, language);
            return cached === text; // Si devuelve lo mismo, falta traducción
        });
        
        if (missing.length > 0) {
            console.log(`[LanguageContext] View actual necesita ${missing.length} traducciones de ${activeTexts.length} textos totales`);
            
            setIsPreparingTranslations(true);
            
            try {
                // forceCheck = false (no forzar si ya sabemos que está caído)
                await translationService.prepareTranslations(missing, language, false);
            } catch (error) {
                console.warn('[LanguageContext] No se pudieron preparar traducciones:', error.message);
            } finally {
                setIsPreparingTranslations(false);
            }
            
            // Si el servicio no está disponible, iniciar monitoreo
            if (translationService.serviceAvailable === false) {
                console.log('[LanguageContext] Iniciando monitoreo para reintento automático');
                // Pasar los textos faltantes al monitoring
                translationService.startHealthMonitoring(async (pendingTexts) => {
                    if (!pendingTexts || pendingTexts.length === 0) {
                        console.log('[LanguageContext] No hay textos pendientes para traducir');
                        return;
                    }
                    
                    console.log(`[LanguageContext] Servicio recuperado, traduciendo ${pendingTexts.length} textos pendientes...`);
                    setIsPreparingTranslations(true);
                    try {
                        await translationService.prepareTranslations(pendingTexts, language, true);
                    } catch (err) {
                        console.warn('[LanguageContext] Reintento automático falló:', err.message);
                    } finally {
                        setIsPreparingTranslations(false);
                    }
                }, missing); // Pasar los textos faltantes
            }
        } else {
            console.log(`[LanguageContext] Todos los textos ya están traducidos (${activeTexts.length} textos)`);
        }
        
        // IMPORTANTE: Limpiar tracking SIEMPRE al final
        // La próxima navegación empezará con tracking limpio
        translationService.clearTracking();
        
    }, [language, isLoading]);

    // ── Cambio de idioma ─────────────────────────────────────────────

    const setLanguage = useCallback(async (code) => {
        if (code === language) return;
        
        console.log(`[LanguageContext] Cambio de idioma: ${language} → ${code}`);
        
        // PASO 1: Mostrar LoadingView INMEDIATAMENTE
        setIsPreparingTranslations(true);
        
        try {
            // PASO 2: Hidratar del storage (traducciones guardadas)
            if (code !== SOURCE_LANGUAGE) {
                await translationService.hydrate(code);
            }
            
            // PASO 3: Preparar traducciones de textos actualmente en uso
            if (code !== SOURCE_LANGUAGE) {
                console.log(`[LanguageContext] Preparando traducciones para textos activos...`);
                try {
                    // forceCheck = true (es un cambio manual del usuario, reintentar siempre)
                    await translationService.prepareCurrentTexts(code);
                    
                    // Si el servicio no está disponible tras cambio de idioma, iniciar monitoring
                    if (translationService.serviceAvailable === false) {
                        const missingTexts = translationService.getActiveTexts().filter(text => {
                            const cached = translationService.getCached(text, code);
                            return cached === text;
                        });
                        
                        if (missingTexts.length > 0) {
                            console.log('[LanguageContext] Iniciando monitoreo tras cambio de idioma');
                            translationService.startHealthMonitoring(async (pendingTexts) => {
                                if (!pendingTexts || pendingTexts.length === 0) return;
                                
                                console.log(`[LanguageContext] Servicio recuperado tras cambio de idioma, traduciendo ${pendingTexts.length} textos...`);
                                setIsPreparingTranslations(true);
                                try {
                                    await translationService.prepareTranslations(pendingTexts, code, true);
                                } finally {
                                    setIsPreparingTranslations(false);
                                }
                            }, missingTexts); // Pasar textos faltantes
                        }
                    }
                    
                    console.log(`[LanguageContext] ✓ Traducciones listas`);
                } catch (error) {
                    console.warn('[LanguageContext] No se pudieron preparar traducciones, continuando:', error.message);
                }
            }
            
            // PASO 4: SOLO AHORA cambiar el idioma (esto dispara re-render)
            console.log(`[LanguageContext] Aplicando idioma ${code}`);
            setLanguageState(code);
            await LanguageStorage.save(code);
            
        } catch (error) {
            console.error('[LanguageContext] Error cambiando idioma:', error);
            // Aplicar cambio aunque falle
            setLanguageState(code);
            await LanguageStorage.save(code);
        } finally {
            // PASO 5: Ocultar LoadingView
            console.log(`[LanguageContext] LoadingView oculta, mostrando View normal`);
            setIsPreparingTranslations(false);
        }
    }, [language]);

    // ── Función t() — SÍNCRONA ───────────────────────────────────────

    const t = useCallback((text) => {
        if (!text) return text;
        return translationService.getCached(text, language);
    }, [language]);

    // ── Valor del contexto ───────────────────────────────────────────

    const value = useMemo(
        () => ({ 
            language, 
            setLanguage,
            checkAndPrepareTranslations,
            t, 
            isLoading,
            isPreparingTranslations,
        }),
        [language, setLanguage, checkAndPrepareTranslations, t, isLoading, isPreparingTranslations],
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

export { LanguageContext };
