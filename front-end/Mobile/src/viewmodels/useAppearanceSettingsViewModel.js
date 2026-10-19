// ============================================================
//  useAppearanceSettingsViewModel
//  Maneja: modo (claro/oscuro) + color de acento con HSL.
//
//  Escribe al ThemeContext global — el cambio se propaga
//  instantáneamente a todas las pantallas sin reiniciar.
// ============================================================
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../view/components/common/ThemeContext';
import {getCurrentUserRole} from '../services/UserService';
import {hslToHex, hexToHsl, evaluateColor} from '../utils/colorUtils';
import {
    VISION_MODES,
    VISION_PRESETS,
    VISION_DESCRIPTIONS,
    DEFAULT_ACCENT,
    DEFAULT_VISION_MODE,
} from '../utils/colorPresets';

export function useAppearanceSettingsViewModel() {
    const navigation = useNavigation();
    const {
        theme,
        accentColor,
        paletteMode,
        setThemeForRole,
        loadThemeForRole,
        setAccentForRole,
        setPaletteForRole,
    } = useTheme();

    // ── Tema ─────────────────────────────────────────────────
    const [selectedTheme, setSelectedTheme] = useState(theme);

    // ── Acento / HSL ─────────────────────────────────────────
    const initialHsl = hexToHsl(accentColor || DEFAULT_ACCENT);
    const [hue, setHue] = useState(initialHsl[0]);
    const [sat, setSat] = useState(initialHsl[1]);
    const [lum, setLum] = useState(initialHsl[2]);

    const currentHex = hslToHex(hue, sat, lum);
    const verdict    = evaluateColor(currentHex);

    // ── Modo de visión ────────────────────────────────────────
    const [visionMode, setVisionMode] = useState(paletteMode ?? DEFAULT_VISION_MODE);

    // ── UI ────────────────────────────────────────────────────
    const [isLoading, setIsLoading] = useState(false);
    const [alertData, setAlertData] = useState({
        message: null, type: 'success', timestamp: 0,
    });

    const clearAlert = useCallback(() => {
        setAlertData({message: null, type: 'success', timestamp: 0});
    }, []);

    // ── Opciones de tema ──────────────────────────────────────
    const themes = useMemo(() => [
        {code: 'light', label: 'settings.lightThemeLabel', icon: '☀️'},
        {code: 'dark',  label: 'settings.darkThemeLabel',  icon: '🌙'},
    ], []);

    // ── Carga inicial desde ThemeContext ─────────────────────
    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const role = await getCurrentUserRole();
                if (!active) return;
                if (role) await loadThemeForRole(role);
            } catch (e) {
                console.error('Error cargando apariencia:', e);
            }
        };
        load();
        return () => { active = false; };
    }, [loadThemeForRole]);

    // Sincronizar tema cuando el contexto global cambia
    useEffect(() => { setSelectedTheme(theme); }, [theme]);

    // Sincronizar HSL cuando accentColor del contexto cambia
    useEffect(() => {
        if (accentColor) {
            const [h, s, l] = hexToHsl(accentColor);
            setHue(h); setSat(s); setLum(l);
        }
    }, [accentColor]);

    // Sincronizar la paleta (modo de visión) cuando cambia en el contexto
    useEffect(() => { setVisionMode(paletteMode); }, [paletteMode]);

    // ── Aplicar HSL → preview ────────────────────────────────
    function applyHSL(h, s, l) {
        setHue(Math.round(h));
        setSat(Math.round(s));
        setLum(Math.round(l));
    }

    function applyPreset(preset) {
        const [h, s, l] = hexToHsl(preset.color);
        applyHSL(h, s, l);
    }

    function handleHexInput(hex) {
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            const [h, s, l] = hexToHsl(hex);
            applyHSL(h, s, l);
        }
    }

    // ── Guardar — escribe al contexto global ─────────────────
    const handleSave = useCallback(async () => {
        setIsLoading(true);
        try {
            const role = await getCurrentUserRole();
            if (!role) {
                setAlertData({
                    message: 'settings.noRoleError',
                    type: 'error',
                    timestamp: Date.now(),
                });
                return;
            }
            // Persiste y propaga tema + paleta + acento a todo el app
            await setThemeForRole(role, selectedTheme);
            await setAccentForRole(role, currentHex);
            const paletteSaved = await setPaletteForRole(role, visionMode);

            setAlertData(paletteSaved ? {
                message: 'settings.appearanceSaved',
                type: 'success',
                timestamp: Date.now(),
            } : {
                message: 'settings.errorSavingAppearance',
                type: 'error',
                timestamp: Date.now(),
            });
        } catch (e) {
            console.error('Error guardando apariencia:', e);
            setAlertData({
                message: 'settings.errorSavingAppearance',
                type: 'error',
                timestamp: Date.now(),
            });
        } finally {
            setIsLoading(false);
        }
    }, [selectedTheme, currentHex, visionMode, setThemeForRole, setAccentForRole, setPaletteForRole]);

    const handleBack = useCallback(() => navigation.goBack(), [navigation]);

    return {
        // Tema
        selectedTheme, setSelectedTheme, themes,
        // Acento / HSL
        visionMode, setVisionMode,
        hue, sat, lum,
        currentHex,
        applyHSL, applyPreset, handleHexInput,
        verdict,
        // Presets
        VISION_MODES, VISION_PRESETS, VISION_DESCRIPTIONS,
        // UI
        isLoading, alertData, clearAlert,
        handleSave, handleBack,
    };
}
