// ============================================================
//  colorPresets — Paletas de colores de acento por tipo de visión
//  Portado desde la web (FaceAttend EDU).
//  Sin dependencias de React ni de UI.
// ============================================================

function hsl(h, s, l) {
    const sv = s / 100;
    const lv = l / 100;
    const k  = (n) => (n + h / 30) % 12;
    const a  = sv * Math.min(lv, 1 - lv);
    const f  = (n) =>
        lv - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return (
        '#' +
        [f(0), f(8), f(4)]
            .map(v => Math.round(v * 255).toString(16).padStart(2, '0'))
            .join('')
    );
}

export const VISION_PRESETS = {
    normal: [
        { key: 'azul',    labelKey: 'appearance.colors.azul',    color: hsl(217, 76, 52) },
        { key: 'verde',   labelKey: 'appearance.colors.verde',   color: hsl(160, 65, 42) },
        { key: 'violeta', labelKey: 'appearance.colors.violeta', color: hsl(258, 68, 57) },
        { key: 'naranja', labelKey: 'appearance.colors.naranja', color: hsl(24,  88, 54) },
        { key: 'neutro',  labelKey: 'appearance.colors.neutro',  color: hsl(220, 14, 46) },
    ],
    deuteranopia: [
        { key: 'azul',    labelKey: 'appearance.colors.azul',    color: hsl(218, 80, 50) },
        { key: 'dorado',  labelKey: 'appearance.colors.dorado',  color: hsl(42,  90, 46) },
        { key: 'violeta', labelKey: 'appearance.colors.violeta', color: hsl(268, 60, 55) },
        { key: 'celeste', labelKey: 'appearance.colors.celeste', color: hsl(196, 80, 45) },
        { key: 'neutro',  labelKey: 'appearance.colors.neutro',  color: hsl(220, 10, 50) },
    ],
    protanopia: [
        { key: 'azul',     labelKey: 'appearance.colors.azul',     color: hsl(214, 82, 48) },
        { key: 'amarillo', labelKey: 'appearance.colors.amarillo', color: hsl(48,  92, 44) },
        { key: 'celeste',  labelKey: 'appearance.colors.celeste',  color: hsl(192, 78, 44) },
        { key: 'violeta',  labelKey: 'appearance.colors.violeta',  color: hsl(260, 55, 55) },
        { key: 'neutro',   labelKey: 'appearance.colors.neutro',   color: hsl(220, 10, 50) },
    ],
    tritanopia: [
        { key: 'rojo',    labelKey: 'appearance.colors.rojo',    color: hsl(358, 72, 52) },
        { key: 'verde',   labelKey: 'appearance.colors.verde',   color: hsl(140, 62, 42) },
        { key: 'rosa',    labelKey: 'appearance.colors.rosa',    color: hsl(330, 65, 55) },
        { key: 'naranja', labelKey: 'appearance.colors.naranja', color: hsl(22,  86, 52) },
        { key: 'neutro',  labelKey: 'appearance.colors.neutro',  color: hsl(220, 10, 50) },
    ],
    achromatopsia: [
        { key: 'gris-osc', labelKey: 'appearance.colors.gris-osc', color: hsl(220, 0, 30) },
        { key: 'gris-med', labelKey: 'appearance.colors.gris-med', color: hsl(220, 0, 45) },
        { key: 'gris-cla', labelKey: 'appearance.colors.gris-cla', color: hsl(220, 0, 60) },
        { key: 'carbon',   labelKey: 'appearance.colors.carbon',    color: hsl(0,   0, 18) },
        { key: 'neutro',   labelKey: 'appearance.colors.neutro',    color: hsl(220, 0, 50) },
    ],
};

export const VISION_MODES = [
    'normal',
    'deuteranopia',
    'protanopia',
    'tritanopia',
    'achromatopsia',
];

export const VISION_DESCRIPTIONS = {
    normal:        'appearance.visionDesc.normal',
    deuteranopia:  'appearance.visionDesc.deuteranopia',
    protanopia:    'appearance.visionDesc.protanopia',
    tritanopia:    'appearance.visionDesc.tritanopia',
    achromatopsia: 'appearance.visionDesc.achromatopsia',
};

// Color de acento por defecto (azul FaceAttend)
export const DEFAULT_ACCENT = hsl(217, 76, 52);
export const DEFAULT_VISION_MODE = 'normal';
