/**
 * Configuración del sistema de diseño (Design Tokens)
 * Base para el tema claro y oscuro
 */

export const DESIGN_TOKENS = {
  // Spacing Scale
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },

  // Border Radius
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    round: 9999,
  },

  // Font Sizes (base - se escalan con useResponsive)
  fontSize: {
    xs: 11,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    xxxl: 24,
    display: 32,
  },

  // Font Weights
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
  },

  // Shadows
  shadows: {
    none: {
      shadowColor: "transparent",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    xl: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
  },

  // Transitions
  transitions: {
    fast: 150,
    normal: 300,
    slow: 500,
  },

  // Z-Index Scale
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1100,
    modal: 1300,
    popover: 1400,
    tooltip: 1500,
    toast: 1600,
  },

  // Breakpoints (para useResponsive)
  breakpoints: {
    mobile: 0,
    tablet: 768,
    desktop: 1024,
    wide: 1440,
  },
};

/**
 * DEPRECADO: LIGHT_THEME y DARK_THEME
 * 
 * Estos temas hardcodeados han sido reemplazados por el sistema dinámico
 * de generación de temas en src/core/theme/generateTheme.js
 * 
 * El tema ahora se genera dinámicamente según:
 * - Colores semánticos personalizados (primary, success, warning, error, text)
 * - Modo de visión (base, deuteranopia, protanopia, tritanopia, achromatopsia)
 * - Tema claro/oscuro
 * 
 * Para obtener el tema actual, usa el hook useTheme():
 *   const { theme } = useTheme();
 *   const colors = theme.colors;
 */

export default DESIGN_TOKENS;
