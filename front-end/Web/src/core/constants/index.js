/**
 * Barrel export para todas las constantes del sistema
 * 
 * NOTA: Colors fue removido del export (deprecated desde v1.0.0)
 * Usa useTheme() del ThemeContext en su lugar:
 * 
 * ```javascript
 * import { useTheme } from '@/context/ThemeContext';
 * const { theme } = useTheme();
 * const colors = theme.colors;
 * ```
 */

// export { default as Colors } from './colors'; // ⚠️ DEPRECATED - Removido del export
export { default as Typography, getTypography } from './typography';
export { BadgePositions, BadgePositionsMobile } from './badgePositions';
export * from './academicPeriods';
export * from './dateFormats';
