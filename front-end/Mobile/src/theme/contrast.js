// ============================================================
//  contrast — matemática de color pura para tokens de tema.
//  Sin React ni UI. Usada por palettes.js y por las pruebas WCAG.
// ============================================================

export const WHITE = '#FFFFFF';
export const INK = '#121212';

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const toChannel = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

export const rgbToHex = ([r, g, b]) => `#${toChannel(r)}${toChannel(g)}${toChannel(b)}`;

export function hexToHslFloat(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
    }
    return [h, s * 100, l * 100];
}

// Conversión HSL→HEX con precisión flotante (las pruebas dependen de ella).
export function hslToHexFloat(h, s, l) {
    const sv = s / 100;
    const lv = l / 100;
    const a = sv * Math.min(lv, 1 - lv);
    const f = (n) => {
        const k = (n + h / 30) % 12;
        return lv - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return rgbToHex([f(0), f(8), f(4)].map((v) => v * 255));
}

// Luminancia relativa WCAG 2.x.
export function relativeLuminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
}

export const minContrast = (hex, surfaces) =>
    Math.min(...surfaces.map((surface) => contrastRatio(hex, surface)));

// Mezcla opaca (sin alfa) para que las pruebas puedan medir el fondo real.
export function mixHex(a, b, weightA) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    return rgbToHex(A.map((v, i) => v * weightA + B[i] * (1 - weightA)));
}

// Texto legible sobre un relleno: blanco o tinta, el de mayor contraste.
export const readableOn = (hex) =>
    contrastRatio(hex, WHITE) >= contrastRatio(hex, INK) ? WHITE : INK;

// Ajusta la luminosidad (en pasos pequeños, manteniendo tono y saturación)
// hasta que el color alcance `minRatio` frente a todas las superficies.
// direction: -1 oscurece (tema claro), +1 aclara (tema oscuro).
export function fitContrast(hex, surfaces, minRatio, direction) {
    const [h, s, startL] = hexToHslFloat(hex);
    let l = startL;
    let candidate = hex;
    for (let step = 0; step <= 200; step += 1) {
        candidate = hslToHexFloat(h, s, l);
        if (minContrast(candidate, surfaces) >= minRatio) return candidate;
        l = Math.min(100, Math.max(0, l + direction * 0.5));
    }
    return candidate;
}
