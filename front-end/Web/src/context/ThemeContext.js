// ============================================================
//  FaceAttend EDU — ThemeContext
//  Proveedor central del sistema de temas.
//
//  Expone:
//    · theme         → ThemeTokens completo (todos los colores)
//    · mode          → "light" | "dark"
//    · visionMode    → "base" | "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia"
//    · customColors  → { visionMode: { primary, success, warning, error, text } }
//    · accentColor   → hex del color de acento actual (DEPRECADO - usar customColors)
//    · setMode()     → cambia el modo y lo persiste
//    · toggleMode()  → alterna entre light/dark
//    · setVisionMode() → cambia el modo de visión
//    · setCustomColors() → actualiza los colores personalizados
//    · setAccentColor() → cambia el accent (DEPRECADO)
//
//  Uso:
//    const { theme } = useTheme();
//    const colors = theme.colors;
//    <View style={{ backgroundColor: colors.background.surface }} />
// ============================================================

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { generateTheme }  from "../core/theme/generateTheme";
import { DEFAULT_ACCENT, DEFAULT_MODE, DEFAULT_VISION_MODE, getInitialCustomColors } from "../core/theme/presets";
import {
    loadAccentColor,
    loadThemeMode,
    loadCustomColors,
    loadVisionMode,
    saveAccentColor,
    saveThemeMode,
    saveCustomColors,
    saveVisionMode,
} from "../core/storage/themeStorage";
import { saveThemeConfigToInstitution } from "../core/config/institutionConfig";

// ── Context ──────────────────────────────────────────────────

const ThemeContext = createContext(null);

// ── Provider ─────────────────────────────────────────────────

export function ThemeProvider({ children }) {
    const [mode,         setModeState]         = useState(DEFAULT_MODE);
    const [visionMode,   setVisionModeState]   = useState(DEFAULT_VISION_MODE);
    
    // ── Colores aplicados (guardados y usados en toda la UI) ──
    const [appliedColors, setAppliedColorsState] = useState(() => getInitialCustomColors());
    
    // ── Colores en preview (temporales, solo para el editor) ──
    const [previewColors, setPreviewColorsState] = useState(null); // null = usar appliedColors
    
    const [accentColor,  setAccentColorState]  = useState(DEFAULT_ACCENT); // DEPRECADO pero mantenido por compatibilidad
    const [isLoading,    setIsLoading]         = useState(true);

    // Cargar preferencias guardadas una sola vez al montar
    useEffect(() => {
        (async () => {
            const [storedMode, storedVisionMode, storedCustomColors, storedAccent] = await Promise.all([
                loadThemeMode(),
                loadVisionMode(),
                loadCustomColors(),
                loadAccentColor(),
            ]);
            
            setModeState(storedMode);
            setVisionModeState(storedVisionMode);
            
            // Si hay colores personalizados guardados, usarlos
            const initialColors = storedCustomColors || getInitialCustomColors();
            setAppliedColorsState(initialColors);
            
            // Mantener compatibilidad con accentColor antiguo
            setAccentColorState(storedAccent);
            
            setIsLoading(false);
        })();
    }, []);

    // ── Sincronizar cambios con institutionConfig ──
    useEffect(() => {
        // Solo sincronizar después de cargar (evitar sobrescribir durante el mount)
        if (isLoading) return;
        
        // Sincronizar theme, appliedColors y visionMode con institutionConfig
        saveThemeConfigToInstitution({
            theme: mode,
            customColors: appliedColors,
            visionMode,
        });
    }, [mode, appliedColors, visionMode, isLoading]);

    // ── Acciones ──────────────────────────────────────────────

    const setMode = async (newMode) => {
        setModeState(newMode);
        await saveThemeMode(newMode);
    };

    const toggleMode = async () => {
        const next = mode === "light" ? "dark" : "light";
        setModeState(next);
        await saveThemeMode(next);
    };

    const setVisionMode = async (newVisionMode) => {
        setVisionModeState(newVisionMode);
        await saveVisionMode(newVisionMode);
    };

    // ── Funciones para preview (NO persisten) ──
    const setPreviewColors = (colors) => {
        setPreviewColorsState(colors);
    };

    const clearPreview = () => {
        setPreviewColorsState(null);
    };

    // ── Función para aplicar colores (persiste y actualiza toda la UI) ──
    const applyColors = async (colors) => {
        setAppliedColorsState(colors);
        setPreviewColorsState(null); // Limpiar preview
        await saveCustomColors(colors);
    };

    // DEPRECADO: Mantener compatibilidad con código antiguo
    const setCustomColors = async (newCustomColors) => {
        // Por compatibilidad, si alguien llama esto directamente, aplicar inmediatamente
        await applyColors(newCustomColors);
    };

    // DEPRECADO: Mantener compatibilidad con código antiguo
    const setAccentColor = async (color) => {
        setAccentColorState(color);
        await saveAccentColor(color);
        
        // También actualizar en appliedColors para sincronización
        const updated = {
            ...appliedColors,
            [visionMode]: {
                ...appliedColors[visionMode],
                primary: color,
            },
        };
        await applyColors(updated);
    };

    // ── Tema derivado (re-calculado cuando cambian colores, vision o mode) ─

    const theme = useMemo(() => {
        // Usar colores aplicados para toda la UI (previewColors solo se usa en el preview)
        const currentVisionColors = appliedColors[visionMode] || {};
        return generateTheme(currentVisionColors, mode);
    }, [appliedColors, visionMode, mode]);

    // ── Tema de preview (para el editor de colores) ─
    const previewTheme = useMemo(() => {
        if (!previewColors) return null; // Si no hay preview, usar null
        const currentVisionColors = previewColors[visionMode] || {};
        return generateTheme(currentVisionColors, mode);
    }, [previewColors, visionMode, mode]);

    return (
        <ThemeContext.Provider
            value={{
                theme,
                previewTheme,
                mode,
                visionMode,
                customColors: appliedColors,  // Exponer como customColors por compatibilidad
                appliedColors,
                previewColors,
                accentColor,  // DEPRECADO
                isLoading,
                setMode,
                toggleMode,
                setVisionMode,
                setPreviewColors,
                clearPreview,
                applyColors,
                setCustomColors, // DEPRECADO - ahora llama applyColors
                setAccentColor, // DEPRECADO
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

// ── Hook ─────────────────────────────────────────────────────

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error(
            "[FaceAttend] useTheme() debe usarse dentro de <ThemeProvider>. " +
            "Asegúrate de envolver app.js con <ThemeProvider>."
        );
    }
    return ctx;
}
