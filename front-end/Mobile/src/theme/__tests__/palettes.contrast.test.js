import {VISION_MODES, VISION_PRESETS} from '../../utils/colorPresets';
import {
    buildThemeColors,
    resolvePaletteMode,
    DEFAULT_ACCENT,
    MIN_TEXT_CONTRAST,
    SURFACE_KEYS,
    CONTENT_SURFACE_KEYS,
    TEXT_TOKENS,
    COLOR_TEXT_TOKENS,
    FILL_PAIRS,
} from '../palettes';
import {contrastRatio, minContrast} from '../contrast';

// Cada modo de visión, con cada uno de sus presets como acento, más el acento por defecto.
const accentsFor = (mode) => [
    DEFAULT_ACCENT,
    ...VISION_PRESETS[mode].map((preset) => preset.color),
];

const cases = VISION_MODES.flatMap((mode) =>
    accentsFor(mode).flatMap((accent) =>
        [false, true].map((isDark) => ({
            name: `${mode} · ${accent} · ${isDark ? 'dark' : 'light'}`,
            colors: buildThemeColors({mode, accent, isDark}),
            isDark,
        })),
    ),
);

describe('palettes — WCAG AA (4.5:1) en tema claro y oscuro', () => {
    test.each(cases)('texto sobre superficies · $name', ({colors}) => {
        const surfaces = SURFACE_KEYS.map((k) => colors[k]);
        for (const token of TEXT_TOKENS) {
            expect(minContrast(colors[token], surfaces)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        }
    });

    test.each(cases)('colores usados como texto · $name', ({colors}) => {
        const surfaces = CONTENT_SURFACE_KEYS.map((k) => colors[k]);
        for (const token of COLOR_TEXT_TOKENS) {
            expect(minContrast(colors[token], surfaces)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        }
    });

    test.each(cases)('categorías cumplen AA y son distintas · $name', ({colors}) => {
        const surfaces = CONTENT_SURFACE_KEYS.map((k) => colors[k]);
        colors.categorical.forEach((c) => {
            expect(minContrast(c, surfaces)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        });
        // Acromatopsia: con AA todos los grises caen en un rango estrecho, así que
        // sus categorías se distinguen por etiqueta/icono (ver palettes.js).
        if (!colors.isAchromatic) {
            expect(new Set(colors.categorical.map((c) => c.toLowerCase())).size).toBe(colors.categorical.length);
        }
    });

    test.each(cases)('texto sobre rellenos (botones, estados) · $name', ({colors}) => {
        for (const [textToken, fillToken] of FILL_PAIRS) {
            expect(contrastRatio(colors[textToken], colors[fillToken])).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        }
    });

    test.each(cases)('texto sobre fondos de estado y badges · $name', ({colors}) => {
        expect(contrastRatio(colors.badgeText, colors.badgeBackground)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        expect(contrastRatio(colors.statusTextPresente, colors.statusPresente)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        expect(contrastRatio(colors.statusTextTarde, colors.statusTarde)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        expect(contrastRatio(colors.modalButtonSecondaryText, colors.modalButtonSecondary)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    });

    test.each(cases)('tema oscuro es realmente oscuro y el claro claro · $name', ({colors, isDark}) => {
        const bgLight = contrastRatio(colors.background, '#000000') > contrastRatio(colors.background, '#FFFFFF');
        expect(bgLight).toBe(!isDark);
    });
});

describe('resolvePaletteMode — respaldo al predeterminado', () => {
    test.each([undefined, null, '', 'inexistente', 'NORMAL'])('paleta %p cae en normal', (mode) => {
        expect(resolvePaletteMode(mode)).toBe('normal');
    });

    test('paletas válidas se conservan', () => {
        VISION_MODES.forEach((mode) => expect(resolvePaletteMode(mode)).toBe(mode));
    });

    test('una paleta inexistente produce los mismos tokens que normal', () => {
        expect(buildThemeColors({mode: 'nope', isDark: false}))
            .toEqual(buildThemeColors({mode: 'normal', isDark: false}));
    });
});

describe('buildThemeColors — integridad de tokens', () => {
    test('expone todos los roles de la paleta como colores hex de 6 dígitos', () => {
        const colors = buildThemeColors({mode: 'deuteranopia', accent: '#2563EB', isDark: true});
        const roles = ['primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'info', 'card', 'background', 'text'];
        roles.forEach((role) => expect(colors[role]).toMatch(/^#[0-9A-F]{6}$/i));
    });

    test('paletas distintas dan secundarios distintos (la paleta se nota)', () => {
        const a = buildThemeColors({mode: 'normal', isDark: false});
        const b = buildThemeColors({mode: 'protanopia', isDark: false});
        expect(a.secondary).not.toBe(b.secondary);
    });

    test('el acento elegido por el usuario llega a primary', () => {
        const colors = buildThemeColors({mode: 'normal', accent: '#2563EB', isDark: false});
        expect(colors.primary.toLowerCase()).toBe('#2563eb');
    });
});
