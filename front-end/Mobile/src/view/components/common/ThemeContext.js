// ============================================================
//  ThemeContext — tema (claro/oscuro) + paleta + acento global
//
//  La paleta (modo de visión) y el acento se guardan por rol en
//  AsyncStorage (palette_<rol>, accent_<rol>). Todos los colores
//  salen de buildThemeColors (src/theme/palettes.js), así cada
//  pantalla que use `colors` cambia al seleccionar una paleta.
//
//  Expone:
//    theme            — 'light' | 'dark'
//    isDark           — boolean
//    paletteMode      — modo de visión activo (clave de VISION_PRESETS)
//    accentColor      — string hex del acento actual
//    colors           — paleta completa ya resuelta para tema y modo
//    toggleTheme
//    setThemeForRole
//    loadThemeForRole
//    setAccentForRole — (role, hex) => Promise<void>
//    setPaletteForRole — (role, mode) => Promise<boolean>
//    loadAccentForRole— (role) => Promise<void>
// ============================================================
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getThemeForRole,
    saveThemeForRole,
    getPaletteForRole,
    savePaletteForRole,
} from '../../../utils/themeByRole';
import {buildThemeColors, resolvePaletteMode, DEFAULT_ACCENT} from '../../../theme/palettes';

// ── Claves AsyncStorage ──────────────────────────────────────
const ACCENT_KEY = (role) => `accent_${role}`;

// ── Helpers AsyncStorage para acento ────────────────────────
export async function getAccentForRole(role, fallback = DEFAULT_ACCENT) {
    if (!role) return fallback;
    try {
        const saved = await AsyncStorage.getItem(ACCENT_KEY(role));
        return saved ?? fallback;
    } catch {
        return fallback;
    }
}

export async function saveAccentForRole(role, hex) {
    if (!role || !hex) return;
    await AsyncStorage.setItem(ACCENT_KEY(role), hex);
}

// ── Contexto ─────────────────────────────────────────────────
const ThemeContext = createContext(null);

export function ThemeProvider({children}) {
    const [theme, setTheme]             = useState('light');
    const [paletteMode, setPaletteMode] = useState(resolvePaletteMode(undefined));
    const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);

    const isDark = theme === 'dark';

    // Paleta completa, recalculada cuando cambian tema, modo o acento
    const colors = useMemo(
        () => buildThemeColors({mode: paletteMode, accent: accentColor, isDark}),
        [paletteMode, accentColor, isDark]
    );

    // ── Carga inicial ─────────────────────────────────────────
    useEffect(() => {
        const restore = async () => {
            try {
                const role   = await AsyncStorage.getItem('userRole');
                const saved  = await getThemeForRole(role ?? 'guest');
                const accent = await getAccentForRole(role ?? 'guest');
                const mode   = await getPaletteForRole(role ?? 'guest');
                setTheme(saved);
                setAccentColor(accent);
                setPaletteMode(mode);
            } catch {
                setTheme('light');
                setAccentColor(DEFAULT_ACCENT);
                setPaletteMode(resolvePaletteMode(undefined));
            }
        };
        restore();
    }, []);

    // ── loadThemeForRole ──────────────────────────────────────
    const loadThemeForRole = useCallback(async (role) => {
        if (!role) return;
        try {
            const saved  = await getThemeForRole(role);
            const accent = await getAccentForRole(role);
            const mode   = await getPaletteForRole(role);
            setTheme(saved);
            setAccentColor(accent);
            setPaletteMode(mode);
        } catch {
            setTheme('light');
        }
    }, []);

    // ── loadAccentForRole ─────────────────────────────────────
    const loadAccentForRole = useCallback(async (role) => {
        if (!role) return;
        try {
            const accent = await getAccentForRole(role);
            setAccentColor(accent);
        } catch {
            setAccentColor(DEFAULT_ACCENT);
        }
    }, []);

    // ── setThemeForRole ───────────────────────────────────────
    const setThemeForRole = useCallback(async (role, newTheme) => {
        if (!role || !newTheme) return;
        try {
            await saveThemeForRole(role, newTheme);
            setTheme(newTheme);
        } catch (e) {
            console.error('Error guardando tema:', e);
        }
    }, []);

    // ── setPaletteForRole ─────────────────────────────────────
    // Aplica la paleta al instante aunque falle el guardado; devuelve
    // false si no se pudo persistir para que la UI lo informe.
    const setPaletteForRole = useCallback(async (role, mode) => {
        const resolved = resolvePaletteMode(mode);
        setPaletteMode(resolved);
        return savePaletteForRole(role, resolved);
    }, []);

    // ── setAccentForRole ──────────────────────────────────────
    const setAccentForRole = useCallback(async (role, hex) => {
        if (!role || !hex) return;
        try {
            await saveAccentForRole(role, hex);
            setAccentColor(hex);
        } catch (e) {
            console.error('Error guardando acento:', e);
        }
    }, []);

    // ── toggleTheme ───────────────────────────────────────────
    const toggleTheme = useCallback(async () => {
        try {
            const role     = await AsyncStorage.getItem('userRole');
            const newTheme = isDark ? 'light' : 'dark';
            await saveThemeForRole(role, newTheme);
            setTheme(newTheme);
        } catch (e) {
            console.error('Error alternando tema:', e);
        }
    }, [isDark]);

    const contextValue = useMemo(
        () => ({
            theme,
            isDark,
            paletteMode,
            accentColor,
            colors,
            toggleTheme,
            setThemeForRole,
            loadThemeForRole,
            setAccentForRole,
            setPaletteForRole,
            loadAccentForRole,
        }),
        [
            theme, isDark, paletteMode, accentColor, colors,
            toggleTheme, setThemeForRole, loadThemeForRole,
            setAccentForRole, setPaletteForRole, loadAccentForRole,
        ]
    );

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
    return ctx;
};

// Exportaciones legacy para compatibilidad con código existente
export const lightColors = buildThemeColors({mode: 'normal', accent: DEFAULT_ACCENT, isDark: false});
export const darkColors  = buildThemeColors({mode: 'normal', accent: DEFAULT_ACCENT, isDark: true});
