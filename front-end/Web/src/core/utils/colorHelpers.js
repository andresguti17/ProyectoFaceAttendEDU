// ============================================================
//  Color Helpers — Utilidades para manejo de colores
// ============================================================
//  Funciones para calcular contraste, luminosidad y colores
//  accesibles basados en WCAG 2.1
// ============================================================

/**
 * Calcula la luminosidad relativa de un color según WCAG 2.1
 * @param {string} hexColor - Color en formato hex (#RRGGBB o #RGB)
 * @returns {number} Luminosidad entre 0 (negro) y 1 (blanco)
 */
export function getRelativeLuminance(hexColor) {
    // Limpiar el # si existe
    const hex = hexColor.replace('#', '');
    
    // Expandir formato corto (#RGB -> #RRGGBB)
    const fullHex = hex.length === 3
        ? hex.split('').map(c => c + c).join('')
        : hex;
    
    // Extraer componentes RGB
    const r = parseInt(fullHex.substring(0, 2), 16) / 255;
    const g = parseInt(fullHex.substring(2, 4), 16) / 255;
    const b = parseInt(fullHex.substring(4, 6), 16) / 255;
    
    // Aplicar corrección gamma según WCAG
    const gammaCorrect = (channel) => {
        return channel <= 0.03928
            ? channel / 12.92
            : Math.pow((channel + 0.055) / 1.055, 2.4);
    };
    
    const R = gammaCorrect(r);
    const G = gammaCorrect(g);
    const B = gammaCorrect(b);
    
    // Calcular luminosidad relativa
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Determina si un color es claro u oscuro
 * @param {string} hexColor - Color en formato hex
 * @returns {boolean} true si es claro, false si es oscuro
 */
export function isLightColor(hexColor) {
    const luminance = getRelativeLuminance(hexColor);
    // Umbral de 0.5 (ajustable según preferencias)
    return luminance > 0.5;
}

/**
 * Obtiene el color de texto apropiado (blanco o negro) según el fondo
 * @param {string} backgroundColor - Color de fondo en hex
 * @returns {string} '#FFFFFF' (blanco) o '#000000' (negro)
 */
export function getContrastTextColor(backgroundColor) {
    return isLightColor(backgroundColor) ? '#000000' : '#FFFFFF';
}

/**
 * Calcula el ratio de contraste entre dos colores según WCAG 2.1
 * @param {string} color1 - Primer color en hex
 * @param {string} color2 - Segundo color en hex
 * @returns {number} Ratio de contraste (1 a 21)
 */
export function getContrastRatio(color1, color2) {
    const lum1 = getRelativeLuminance(color1);
    const lum2 = getRelativeLuminance(color2);
    
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Verifica si el contraste cumple con WCAG AA
 * @param {string} foreground - Color del texto
 * @param {string} background - Color del fondo
 * @param {string} level - Nivel AA o AAA (default: 'AA')
 * @returns {boolean} true si cumple el nivel
 */
export function meetsWCAGContrast(foreground, background, level = 'AA') {
    const ratio = getContrastRatio(foreground, background);
    const minRatio = level === 'AAA' ? 7 : 4.5;
    return ratio >= minRatio;
}

/**
 * Ajusta la opacidad de un color hex
 * @param {string} hexColor - Color en hex
 * @param {number} opacity - Opacidad de 0 a 1
 * @returns {string} Color en formato rgba
 */
export function hexToRgba(hexColor, opacity = 1) {
    const hex = hexColor.replace('#', '');
    const fullHex = hex.length === 3
        ? hex.split('').map(c => c + c).join('')
        : hex;
    
    const r = parseInt(fullHex.substring(0, 2), 16);
    const g = parseInt(fullHex.substring(2, 4), 16);
    const b = parseInt(fullHex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
