/**
 * Sistema tipográfico de FaceAttend EDU
 * 
 * Función que recibe `fs` (font-scaler) del hook useResponsive
 * para adaptar los tamaños al viewport.
 * 
 * @param {Function} fs - Font scaler function from useResponsive
 * @returns {Object} Estilos tipográficos
 * 
 * @example
 * ```javascript
 * import { useResponsive } from '@/view/hooks/useResponsive';
 * import { getTypography } from '@/core/constants/typography';
 * 
 * function MyComponent() {
 *   const { fs } = useResponsive();
 *   const T = getTypography(fs);
 *   return <Text style={T.displayLG}>Hello</Text>;
 * }
 * ```
 */
export function getTypography(fs) {
  return {
    // Display / Headings
    displayXL: {
      fontSize: fs(52),
      fontWeight: "800",
      lineHeight: fs(62),
      letterSpacing: -1.5,
    },
    displayLG: {
      fontSize: fs(36),
      fontWeight: "800",
      lineHeight: fs(44),
      letterSpacing: -1,
    },
    heading1: {
      fontSize: fs(28),
      fontWeight: "700",
      lineHeight: fs(36),
      letterSpacing: -0.5,
    },
    heading2: {
      fontSize: fs(22),
      fontWeight: "700",
      lineHeight: fs(30),
      letterSpacing: -0.3,
    },

    // Brand / Nav
    brandName: {
      fontSize: fs(18),
      fontWeight: "700",
      letterSpacing: -0.3,
    },

    // Eyebrow
    eyebrow: {
      fontSize: fs(13),
      fontWeight: "600",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },

    // Body
    bodyLG: {
      fontSize: fs(16),
      fontWeight: "400",
      lineHeight: fs(26),
    },
    bodyMD: {
      fontSize: fs(14),
      fontWeight: "400",
      lineHeight: fs(22),
    },
    bodySM: {
      fontSize: fs(12),
      fontWeight: "400",
      lineHeight: fs(18),
    },

    // Buttons
    buttonMD: {
      fontSize: fs(15),
      fontWeight: "700",
    },
    buttonSM: {
      fontSize: fs(13),
      fontWeight: "600",
    },

    // Stats / Metrics
    statValue: {
      fontSize: fs(22),
      fontWeight: "800",
    },
    statLabel: {
      fontSize: fs(12),
      fontWeight: "400",
      marginTop: fs(2),
    },

    // Badge / Labels
    badgeLabel: {
      fontSize: fs(12),
      fontWeight: "600",
    },

    // Footer
    caption: {
      fontSize: fs(11),
      fontWeight: "400",
    },
  };
}

/**
 * Exportación estática para compatibilidad legacy
 * (sin escalado responsivo)
 */
const Typography = getTypography((n) => n);
export default Typography;
