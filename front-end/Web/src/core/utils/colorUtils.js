// ============================================================
//  FaceAttend EDU — colorUtils
//
//  Utilidades puras de manipulación y evaluación de colores.
//  
//  Sistema basado en sRGB/OKLCH para continuidad perceptual.
//  - OKLCH: espacio perceptualmente uniforme para interpolación
//  - sRGB: espacio de salida (HEX)
//  - WCAG: contraste calculado en sRGB
//  
//  NO utiliza HSL.
//  NO requiere dependencias externas.
//  Implementación matemática completa de conversiones.
// ============================================================

// ============================================================
// CONVERSIÓN sRGB ↔ Linear RGB
// ============================================================

function srgbToLinear(channel) {
    const c = channel / 255;
    return c <= 0.04045 
        ? c / 12.92 
        : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(channel) {
    const c = channel <= 0.0031308
        ? channel * 12.92
        : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
}

// ============================================================
// CONVERSIÓN Linear RGB ↔ OKLab (Björn Ottosson)
// ============================================================

function linearRgbToOklab(r, g, b) {
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    
    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);
    
    return {
        L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    };
}

function oklabToLinearRgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    
    return {
        r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    };
}

// ============================================================
// CONVERSIÓN OKLab ↔ OKLCH
// ============================================================

function oklabToOklch(L, a, b) {
    const C = Math.sqrt(a * a + b * b);
    let H = Math.atan2(b, a) * 180 / Math.PI;
    if (H < 0) H += 360;
    return { L, C, H };
}

function oklchToOklab(L, C, H) {
    const hRad = H * Math.PI / 180;
    return {
        L,
        a: C * Math.cos(hRad),
        b: C * Math.sin(hRad)
    };
}

// ============================================================
// PIPELINE HEX ↔ OKLCH
// ============================================================

function hexToOklch(hex) {
    const rgb = hexToRgb(hex);
    const linR = srgbToLinear(rgb.r);
    const linG = srgbToLinear(rgb.g);
    const linB = srgbToLinear(rgb.b);
    const lab = linearRgbToOklab(linR, linG, linB);
    return oklabToOklch(lab.L, lab.a, lab.b);
}

function oklchToHex(L, C, H) {
    // Clamp L y C a rangos válidos
    L = Math.max(0, Math.min(1, L));
    C = Math.max(0, C);
    
    const lab = oklchToOklab(L, C, H);
    const linRgb = oklabToLinearRgb(lab.L, lab.a, lab.b);
    
    // Clamp RGB a rango válido (gamut sRGB)
    const r = linearToSrgb(linRgb.r);
    const g = linearToSrgb(linRgb.g);
    const b = linearToSrgb(linRgb.b);
    
    return rgbToHex(r, g, b);
}

// ── Conversión HEX ↔ RGB ──────────────────────────────────────

/**
 * Convierte HEX a RGB
 * @param {string} hex - Color en formato HEX (#RRGGBB)
 * @returns {{r: number, g: number, b: number}} Objeto RGB con valores 0-255
 */
export function hexToRgb(hex) {
    const cleanHex = hex.replace('#', '');
    return {
        r: parseInt(cleanHex.slice(0, 2), 16),
        g: parseInt(cleanHex.slice(2, 4), 16),
        b: parseInt(cleanHex.slice(4, 6), 16),
    };
}

/**
 * Convierte RGB a HEX
 * @param {number} r - Rojo (0-255)
 * @param {number} g - Verde (0-255)
 * @param {number} b - Azul (0-255)
 * @returns {string} Color en formato HEX (#RRGGBB)
 */
export function rgbToHex(r, g, b) {
    const toHex = (n) => {
        const clamped = Math.max(0, Math.min(255, Math.round(n)));
        return clamped.toString(16).padStart(2, '0');
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Valida si un string es un color HEX válido
 * @param {string} hex - String a validar
 * @returns {boolean}
 */
export function isValidHex(hex) {
    return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

// ── Matemática de color RGB para picker visual ────────────────

/**
 * Convierte RGB a valores de Hue (matiz) para el círculo cromático.
 * Solo se usa internamente para generar el gradiente del selector de matiz.
 * NO es HSL - es una transformación matemática directa de RGB.
 * 
 * @param {number} r - Rojo (0-255)
 * @param {number} g - Verde (0-255)
 * @param {number} b - Azul (0-255)
 * @returns {number} Hue en grados (0-360)
 */
export function rgbToHue(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    if (max === min) return 0; // Gris - sin matiz definido
    
    const delta = max - min;
    let h = 0;
    
    if (max === r) {
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
        h = ((b - r) / delta + 2) / 6;
    } else {
        h = ((r - g) / delta + 4) / 6;
    }
    
    return h * 360;
}

/**
 * Obtiene un color RGB puro del círculo cromático para un ángulo dado.
 * Genera colores saturados puros en el perímetro del círculo de color.
 * 
 * @param {number} hue - Ángulo en grados (0-360)
 * @returns {{r: number, g: number, b: number}} RGB (0-255)
 */
export function hueToRgb(hue) {
    const h = ((hue % 360) + 360) % 360; // Normalizar 0-360
    const segment = Math.floor(h / 60);
    const remainder = (h % 60) / 60;
    
    let r = 0, g = 0, b = 0;
    
    switch (segment) {
        case 0: // Rojo a Amarillo
            r = 255;
            g = Math.round(255 * remainder);
            b = 0;
            break;
        case 1: // Amarillo a Verde
            r = Math.round(255 * (1 - remainder));
            g = 255;
            b = 0;
            break;
        case 2: // Verde a Cian
            r = 0;
            g = 255;
            b = Math.round(255 * remainder);
            break;
        case 3: // Cian a Azul
            r = 0;
            g = Math.round(255 * (1 - remainder));
            b = 255;
            break;
        case 4: // Azul a Magenta
            r = Math.round(255 * remainder);
            g = 0;
            b = 255;
            break;
        case 5: // Magenta a Rojo
            r = 255;
            g = 0;
            b = Math.round(255 * (1 - remainder));
            break;
    }
    
    return { r, g, b };
}

/**
 * Calcula la luminancia relativa de un color RGB según WCAG.
 * @param {number} r - Rojo (0-255)
 * @param {number} g - Verde (0-255)
 * @param {number} b - Azul (0-255)
 * @returns {number} Luminancia relativa (0-1)
 */
function getRelativeLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
        const val = c / 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calcula el ratio de contraste entre dos colores según WCAG.
 * @param {{r: number, g: number, b: number}} rgb1 - Color 1
 * @param {{r: number, g: number, b: number}} rgb2 - Color 2
 * @returns {number} Ratio de contraste (1-21)
 */
function getContrastRatioRGB(rgb1, rgb2) {
    const lum1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
}

// ══════════════════════════════════════════════════════════════
// NOTA: combineSemanticWithFont fue removida del flujo.
// Ahora el color de Fuentes se usa DIRECTAMENTE, solo ajustando
// luminosidad para contraste. Sin mezcla con colores semánticos.
// ══════════════════════════════════════════════════════════════

/**
 * Ajusta la luminosidad de un color para alcanzar contraste WCAG mínimo.
 * 
 * Utiliza búsqueda binaria para encontrar el valor óptimo de L (luminosidad)
 * en OKLCH, manteniendo C (chroma) y H (hue) constantes.
 * 
 * Esto garantiza:
 * - PRECISIÓN continua (no steps discretos)
 * - IDENTIDAD CROMÁTICA preservada (solo cambia luminosidad)
 * - MÍNIMO cambio necesario para alcanzar contraste objetivo
 * 
 * @param {string} colorHex - Color base en HEX
 * @param {{r: number, g: number, b: number}} backgroundRGB - Color de fondo en RGB
 * @param {number} minContrast - Ratio mínimo de contraste WCAG (default: 4.5 para AA)
 * @returns {string} Color ajustado en HEX
 */
export function adjustBrightnessForContrast(colorHex, backgroundRGB, minContrast = 4.5) {
    // Convertir a OKLCH
    const baseOklch = hexToOklch(colorHex);
    
    // Calcular contraste actual
    const bgHex = rgbToHex(backgroundRGB.r, backgroundRGB.g, backgroundRGB.b);
    const currentContrast = getContrastRatio(colorHex, bgHex);
    
    // Si ya cumple, retornar sin modificar
    if (currentContrast >= minContrast) {
        return colorHex;
    }
    
    // Determinar dirección del ajuste probando ambas
    const testHigher = oklchToHex(Math.min(baseOklch.L + 0.1, 1), baseOklch.C, baseOklch.H);
    const testLower = oklchToHex(Math.max(baseOklch.L - 0.1, 0), baseOklch.C, baseOklch.H);
    const contrastHigher = getContrastRatio(testHigher, bgHex);
    const contrastLower = getContrastRatio(testLower, bgHex);
    
    const shouldIncrease = contrastHigher > contrastLower;
    
    // Búsqueda binaria del L óptimo
    let low = shouldIncrease ? baseOklch.L : 0;
    let high = shouldIncrease ? 1 : baseOklch.L;
    let bestL = baseOklch.L;
    let bestContrast = currentContrast;
    
    // 20 iteraciones = precisión ~0.000001
    for (let i = 0; i < 20; i++) {
        const mid = (low + high) / 2;
        const testHex = oklchToHex(mid, baseOklch.C, baseOklch.H);
        const testContrast = getContrastRatio(testHex, bgHex);
        
        if (testContrast > bestContrast) {
            bestL = mid;
            bestContrast = testContrast;
        }
        
        // Si estamos suficientemente cerca del objetivo, retornar
        if (Math.abs(testContrast - minContrast) < 0.01) {
            return oklchToHex(mid, baseOklch.C, baseOklch.H);
        }
        
        // Ajustar rango de búsqueda
        if (testContrast < minContrast) {
            if (shouldIncrease) {
                low = mid;
            } else {
                high = mid;
            }
        } else {
            if (shouldIncrease) {
                high = mid;
            } else {
                low = mid;
            }
        }
    }
    
    // Retornar mejor resultado encontrado
    return oklchToHex(bestL, baseOklch.C, baseOklch.H);
}

/**
 * Calcula el ratio de contraste entre dos colores según WCAG.
 * @param {string} hex1 - Primer color en HEX
 * @param {string} hex2 - Segundo color en HEX
 * @returns {number} Ratio de contraste (1-21)
 */
function getContrastRatio(hex1, hex2) {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    const lum1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Ajusta la luminosidad/brillo de un color RGB manteniendo el matiz.
 * Interpolación lineal entre negro (brightness=0) y color puro (brightness=1).
 * Usado internamente por calculateColorFromPanel.
 * 
 * @param {{r: number, g: number, b: number}} rgb - Color base
 * @param {number} brightness - Factor de brillo (0=negro, 1=color puro)
 * @returns {{r: number, g: number, b: number}} RGB ajustado
 */
export function adjustBrightness(rgb, brightness) {
    const b = Math.max(0, Math.min(1, brightness));
    return {
        r: Math.round(rgb.r * b),
        g: Math.round(rgb.g * b),
        b: Math.round(rgb.b * b),
    };
}

/**
 * Mezcla un color RGB con blanco para reducir saturación.
 * 
 * @param {{r: number, g: number, b: number}} rgb - Color base
 * @param {number} whiteness - Factor de blanco (0=color puro, 1=blanco)
 * @returns {{r: number, g: number, b: number}} RGB mezclado
 */
export function mixWithWhite(rgb, whiteness) {
    const w = Math.max(0, Math.min(1, whiteness));
    return {
        r: Math.round(rgb.r + (255 - rgb.r) * w),
        g: Math.round(rgb.g + (255 - rgb.g) * w),
        b: Math.round(rgb.b + (255 - rgb.b) * w),
    };
}

/**
 * Calcula el color resultante en el panel 2D del picker.
 * 
 * Panel 2D funciona así:
 * - Eje X (0-100): saturación (0=blanco, 100=color puro)
 * - Eje Y (0-100): luminosidad (0=negro, 100=color puro del matiz)
 * 
 * Matemática:
 * 1. Obtener color puro del matiz
 * 2. Interpolar con blanco según X (saturación)
 * 3. Interpolar con negro según Y (luminosidad)
 * 
 * @param {number} hue - Matiz en grados (0-360)
 * @param {number} saturation - Saturación (0-100)
 * @param {number} brightness - Luminosidad (0-100)
 * @returns {string} Color resultante en HEX
 */
export function calculateColorFromPanel(hue, saturation, brightness) {
    // 1. Color puro del matiz
    const pureColor = hueToRgb(hue);
    
    // 2. Mezclar con blanco según saturación (X)
    const whiteness = 1 - (saturation / 100);
    const desaturated = mixWithWhite(pureColor, whiteness);
    
    // 3. Ajustar brillo (Y)
    const brightnessValue = brightness / 100;
    const final = adjustBrightness(desaturated, brightnessValue);
    
    return rgbToHex(final.r, final.g, final.b);
}

/**
 * Extrae los valores del panel (hue, saturation, brightness) desde un HEX.
 * Inversa de calculateColorFromPanel.
 * 
 * @param {string} hex - Color en HEX
 * @returns {{hue: number, saturation: number, brightness: number}}
 */
export function extractPanelValues(hex) {
    const rgb = hexToRgb(hex);
    const { r, g, b } = rgb;
    
    // Normalizar a 0-1
    const rN = r / 255;
    const gN = g / 255;
    const bN = b / 255;
    
    const max = Math.max(rN, gN, bN);
    const min = Math.min(rN, gN, bN);
    const delta = max - min;
    
    // Calcular Hue (matiz)
    let hue = 0;
    if (delta !== 0) {
        if (max === rN) {
            hue = ((gN - bN) / delta + (gN < bN ? 6 : 0)) / 6;
        } else if (max === gN) {
            hue = ((bN - rN) / delta + 2) / 6;
        } else {
            hue = ((rN - gN) / delta + 4) / 6;
        }
    }
    hue = hue * 360;
    
    // Brightness es simplemente el valor máximo del RGB
    const brightness = max * 100;
    
    // Saturation: si brightness=0, saturation=0; sino, delta/max
    const saturation = max === 0 ? 0 : (delta / max) * 100;
    
    return {
        hue: Math.round(hue),
        saturation: Math.round(saturation),
        brightness: Math.round(brightness),
    };
}

// ── Evaluador de color ────────────────────────────────────────
// Recibe un color HEX y un helper de traducción,
// devuelve un veredicto completo para mostrar en la UI.

export function evaluateColor(hex, t) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = (v) =>
        v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const contrastVsWhite = 1.05 / (L + 0.05);
    const contrastVsBlack = (L + 0.05) / 0.05;
    const bestContrast = Math.max(contrastVsWhite, contrastVsBlack);

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lv = (max + min) / 2;
    const sv = max === min
        ? 0
        : lv > 0.5
            ? (max - min) / (2 - max - min)
            : (max - min) / (max + min);
    let hv = 0;
    if (max !== min) {
        switch (max) {
            case r:
                hv = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                hv = ((b - r) / (max - min) + 2) / 6;
                break;
            case b:
                hv = ((r - g) / (max - min) + 4) / 6;
                break;
            default:
                break;
        }
    }
    const hueDeg = Math.round(hv * 360);
    const satPct = Math.round(sv * 100);
    const lumPct = Math.round(lv * 100);

    // ── WCAG ─────────────────────────────────────────────────
    let wcagLevel;
    if (bestContrast >= 7)        wcagLevel = "AAA";
    else if (bestContrast >= 4.5) wcagLevel = "AA";
    else if (bestContrast >= 3)   wcagLevel = "A";
    else                          wcagLevel = "Falla";

    // ── Legibilidad ──────────────────────────────────────────
    let readability;
    if (contrastVsWhite >= 7)
        readability = t("Texto blanco encima se ve perfecto");
    else if (contrastVsWhite >= 4.5)
        readability = t("Texto blanco es legible sin problema");
    else if (contrastVsWhite >= 3)
        readability = t("Texto blanco se ve, pero cuesta leerlo — mejor usar texto oscuro");
    else
        readability = t("Texto blanco encima no se lee bien — este color es demasiado claro");

    // ── Vibe de color ────────────────────────────────────────
    let vibe;
    if (satPct < 15)
        vibe = t("Tono neutro — discreto, no llama la atención");
    else if (hueDeg < 30 || hueDeg >= 340)
        vibe = t("Rojo — enérgico y llamativo, úsalo con moderación");
    else if (hueDeg < 60)
        vibe = t("Naranja / dorado — cálido y amigable");
    else if (hueDeg < 150)
        vibe = t("Verde — fresco, transmite calma y confianza");
    else if (hueDeg < 200)
        vibe = t("Cian / turquesa — moderno y tecnológico");
    else if (hueDeg < 260)
        vibe = t("Azul — profesional, genera confianza");
    else if (hueDeg < 310)
        vibe = t("Violeta / púrpura — creativo y sofisticado");
    else
        vibe = t("Rosa / magenta — expresivo y llamativo");

    // ── Adecuación UI ────────────────────────────────────────
    let uiFit;
    if (lumPct > 80)
        uiFit = t("Muy claro — puede perderse sobre fondos blancos");
    else if (lumPct < 20)
        uiFit = t("Muy oscuro — puede confundirse con el texto");
    else if (satPct < 15)
        uiFit = t("Poco saturado — funciona como neutro, pero puede pasar desapercibido");
    else if (satPct > 95 && lumPct > 60)
        uiFit = t("Muy vibrante — llama la atención, puede cansar en uso prolongado");
    else
        uiFit = t("Proporciones equilibradas — ideal para botones, tabs y bordes");

    // ── Consejo ──────────────────────────────────────────────
    let tip;
    if (contrastVsWhite < 3 && lumPct > 70)
        tip = t("Baja la luminosidad 15–20 puntos para que el texto blanco sea legible");
    else if (contrastVsWhite < 4.5 && lumPct > 55)
        tip = t("Baja la luminosidad 8–10 puntos para mejorar la legibilidad");
    else if (satPct < 15 && lumPct > 50)
        tip = t("Sube la saturación para que el acento resalte sobre los fondos");
    else if (lumPct > 80)
        tip = t("Este tono es muy pálido — bájalo para que se vea como un acento real");
    else
        tip = t("Este color funciona bien — no necesita ajustes");

    // ── Score global ─────────────────────────────────────────
    // NOTA: Estos colores son independientes del tema del usuario
    // ya que representan evaluaciones universales (éxito, advertencia, error)
    let score = "score";
    let scoreColor;
    if (contrastVsWhite >= 4.5 && satPct >= 15 && lumPct >= 20 && lumPct <= 78) {
        score = "excelente";
        scoreColor = "success"; // Verde - excelente calidad
    } else if (contrastVsWhite >= 3 && satPct >= 10 && lumPct >= 18 && lumPct <= 82) {
        score = "bueno";
        scoreColor = "success"; // Verde - buena calidad
    } else if (contrastVsWhite >= 2.5 || contrastVsBlack >= 4.5) {
        score = "aceptable";
        scoreColor = "warning"; // Naranja - aceptable
    } else if (lumPct > 80 || lumPct < 15) {
        score = "precaución";
        scoreColor = "warning"; // Naranja - precaución
    } else {
        score = "problemático";
        scoreColor = "error"; // Rojo - problemático
    }

    return {
        score,
        scoreColor,
        readability,
        vibe,
        uiFit,
        tip,
        contrastRatio: Math.round(bestContrast * 10) / 10,
        wcagLevel,
    };
}
