// ============================================================
//  palettes — tokens de tema derivados de la paleta elegida.
//
//  Cada modo de visión (VISION_PRESETS) aporta sus roles:
//    primary    → acento elegido por el usuario (primer rol)
//    secondary, accent, success, warning, danger, info → roles fijos
//      del modo, pensados para ser distinguibles en ese tipo de visión
//    neutral    → matiz de fondos, superficies y texto
//
//  Todo color que se usa como texto o relleno pasa por fitContrast,
//  así WCAG AA (4.5:1) se cumple en tema claro y oscuro.
//  Pruebas: src/theme/__tests__/palettes.contrast.test.js
// ============================================================
import {VISION_MODES, DEFAULT_VISION_MODE} from '../utils/colorPresets';
import {
    fitContrast,
    hslToHexFloat,
    mixHex,
    readableOn,
    WHITE,
} from './contrast';

export const MIN_TEXT_CONTRAST = 4.5; // WCAG 1.4.3 (texto normal)
export const DEFAULT_ACCENT = '#1392ED';

// Roles por modo, en HSL. Los estados (success/warning/danger/info) se eligen
// para no depender solo del verde/rojo en cada tipo de visión. Aun así,
// los estados deben acompañarse de icono o texto en la UI.
// Achromatopsia no tiene tono: se separan por luminosidad.
export const PALETTE_SPECS = {
    normal: {
        neutral:   [220, 14],
        secondary: [160, 65, 42],
        accent:    [258, 68, 57],
        success:   [142, 60, 40],
        warning:   [38, 92, 50],
        danger:    [2, 72, 50],
        info:      [205, 85, 50],
    },
    deuteranopia: {
        neutral:   [220, 10],
        secondary: [42, 90, 46],
        accent:    [268, 60, 55],
        success:   [190, 75, 38],
        warning:   [32, 95, 48],
        danger:    [350, 72, 46],
        info:      [214, 82, 50],
    },
    protanopia: {
        neutral:   [220, 10],
        secondary: [48, 92, 44],
        accent:    [260, 55, 55],
        success:   [192, 78, 38],
        warning:   [36, 95, 48],
        danger:    [340, 70, 42],
        info:      [200, 80, 45],
    },
    tritanopia: {
        neutral:   [220, 10],
        secondary: [140, 62, 42],
        accent:    [330, 65, 55],
        success:   [125, 60, 28],
        warning:   [22, 86, 52],
        danger:    [358, 72, 50],
        info:      [275, 60, 52],
    },
    achromatopsia: {
        neutral:   [220, 0],
        secondary: [220, 0, 45],
        accent:    [220, 0, 60],
        success:   [220, 0, 35],
        warning:   [220, 0, 55],
        danger:    [0, 0, 20],
        info:      [220, 0, 45],
    },
};

// Fondos de contenido: aquí se usa el color de la paleta como texto o icono.
export const CONTENT_SURFACE_KEYS = [
    'background', 'backgroundWhite', 'card', 'inputBackground', 'categoryBackground',
    'backButtonBackground', 'modalBackground', 'modalInputBackground', 'modalButtonSecondary',
];
// Todas las superficies, incluidas barras de navegación y pestañas (texto secundario).
export const SURFACE_KEYS = [...CONTENT_SURFACE_KEYS, 'navBar', 'tabInactive'];

export const resolvePaletteMode = (mode) =>
    VISION_MODES.includes(mode) ? mode : DEFAULT_VISION_MODE;

export function buildThemeColors({mode, accent = DEFAULT_ACCENT, isDark = false} = {}) {
    const spec = PALETTE_SPECS[resolvePaletteMode(mode)];
    const [hue, neutralSat] = spec.neutral;
    const tone = (l) => hslToHexFloat(hue, neutralSat * 0.5, l);
    const dir = isDark ? 1 : -1; // hacia el lado con contraste

    // ── Superficies (fondos y tarjetas) ───────────────────────
    const surfaces = isDark
        ? {
            background: tone(7),      backgroundWhite: tone(12),  card: tone(17),
            inputBackground: tone(15), navBar: tone(12),          tabInactive: tone(15),
            separator: tone(20),      progressBackground: tone(23),
            cardBorder: tone(15),     border: tone(18),           categoryBackground: tone(15),
            backButtonBackground: tone(15), modalBackground: tone(17),
            modalInputBackground: tone(22), modalButtonSecondary: tone(22),
        }
        : {
            background: tone(96),     backgroundWhite: WHITE,     card: WHITE,
            inputBackground: WHITE,   navBar: tone(93),           tabInactive: tone(85),
            separator: tone(82),      progressBackground: tone(88),
            cardBorder: tone(91),     border: tone(88),           categoryBackground: tone(94),
            backButtonBackground: tone(96), modalBackground: WHITE,
            modalInputBackground: tone(98), modalButtonSecondary: tone(96),
        };

    const textOn = (l) => fitContrast(tone(l), SURFACE_KEYS.map((k) => surfaces[k]), MIN_TEXT_CONTRAST, dir);
    const fit = (hex, backgrounds = []) =>
        fitContrast(hex, [...CONTENT_SURFACE_KEYS.map((k) => surfaces[k]), ...backgrounds], MIN_TEXT_CONTRAST, dir);

    // ── Texto ─────────────────────────────────────────────────
    const text          = textOn(isDark ? 96 : 10);
    const textSecondary = textOn(isDark ? 68 : 38);
    const textMuted     = textOn(isDark ? 58 : 46);

    // ── Roles de color ────────────────────────────────────────
    const hslHex = (c) => hslToHexFloat(...c);
    const primary   = fit(accent);
    const secondary = fit(hslHex(spec.secondary));
    const accentTok = fit(hslHex(spec.accent));
    const success   = fit(hslHex(spec.success));
    const warning   = fit(hslHex(spec.warning));
    const danger    = fit(hslHex(spec.danger));
    const info      = fit(hslHex(spec.info));

    // Fondos suaves de estado: el color mezclado con la tarjeta.
    const badgeBackground   = mixHex(primary, surfaces.card, 0.14);
    const badgeText         = fit(primary, [badgeBackground]);
    const statusPresente    = mixHex(success, surfaces.card, 0.14);
    const statusTarde       = mixHex(warning, surfaces.card, 0.14);
    const statusTextPresente = fit(success, [statusPresente]);
    const statusTextTarde    = fit(warning, [statusTarde]);

    return {
        ...surfaces,

        // Texto
        text,
        textSecondary,
        textMuted,
        textSecondaryButtons: text,
        categoryText:         text,
        modalText:            text,
        modalTextSecondary:   textSecondary,
        modalInputText:       text,
        modalInputPlaceholder: textMuted,
        modalButtonSecondaryText: textSecondary,

        // Primario y acento
        primary,
        onPrimary:    readableOn(primary),
        primaryLight: primary + '20',
        tabActive:    primary,
        customtabs:   primary,
        secondary,
        accent:       accentTok,

        // Estados (texto/icono) y su relleno legible
        success,
        warning,
        danger,
        info,
        onSuccess: readableOn(success),
        onWarning: readableOn(warning),
        onDanger:  readableOn(danger),
        onInfo:    readableOn(info),

        // Compatibilidad con nombres previos
        novedadSuccess: success,
        novedadWarning: warning,
        novedadInfo:    info,
        statusPresente,
        statusTarde,
        statusTextPresente,
        statusTextTarde,
        badgeBackground,
        badgeText,
        surface: surfaces.card,

        // Modales y controles
        modalButton:         primary,
        modalButtonText:     readableOn(primary),
        modalOptionSelected: badgeBackground,
        modalOptionBorder:   primary,
        modalRadioBorder:    textSecondary,
        modalRadioSelected:  primary,
        modalBorder:         surfaces.border,
        modalOverlay:        isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
        overlay:             isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',

        // Vista de cámara: fija por decisión de diseño (no cambia con la paleta)
        cameraBackground: '#000000',
        onCamera:         WHITE,

        // Colores categóricos (tarjetas, avatares, tipos): orden estable entre paletas
        // Sin primary: es el acento de navegación y podría coincidir con una categoría.
        categorical: [secondary, accentTok, info, success, warning, danger],
        isAchromatic: mode === 'achromatopsia',
    };
}

// Tokens de texto y de color-como-texto que deben cumplir AA.
export const TEXT_TOKENS = ['text', 'textSecondary', 'textMuted', 'modalText', 'modalTextSecondary', 'modalInputPlaceholder'];
export const COLOR_TEXT_TOKENS = ['primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'info', 'badgeText', 'statusTextPresente', 'statusTextTarde', 'modalRadioSelected'];
export const FILL_PAIRS = [
    ['onPrimary', 'primary'],
    ['onSuccess', 'success'],
    ['onWarning', 'warning'],
    ['onDanger', 'danger'],
    ['onInfo', 'info'],
    ['modalButtonText', 'modalButton'],
];
