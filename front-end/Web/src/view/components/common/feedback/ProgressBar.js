import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Barra de progreso horizontal mejorada
 * 
 * Componente de barra de progreso con variants de color, animación opcional,
 * y estilos adicionales (striped, animated). Ideal para mostrar progreso
 * de operaciones, porcentajes de completitud, etc.
 * 
 * @param {number} value - Valor actual (0-100)
 * @param {number} max - Valor máximo (default: 100)
 * @param {string} label - Etiqueta opcional
 * @param {boolean} showPercentage - Mostrar porcentaje (default: false)
 * @param {('default'|'primary'|'success'|'warning'|'danger'|'info')} variant - Variante de color
 * @param {('sm'|'md'|'lg')} size - Tamaño de la barra
 * @param {boolean} striped - Estilo rayado (default: false)
 * @param {boolean} animated - Animar el progreso (default: false)
 * @param {object} style - Estilos adicionales del contenedor
 * 
 * @example
 * // ProgressBar básico
 * <ProgressBar value={75} />
 * 
 * @example
 * // Con label y porcentaje
 * <ProgressBar
 *   label="Progreso de carga"
 *   value={uploadProgress}
 *   showPercentage
 * />
 * 
 * @example
 * // Con variant de color
 * <ProgressBar
 *   value={attendance}
 *   variant={attendance >= 80 ? "success" : "warning"}
 *   showPercentage
 * />
 * 
 * @example
 * // Animado con estilo striped
 * <ProgressBar
 *   value={progress}
 *   variant="primary"
 *   striped
 *   animated
 * />
 * 
 * @example
 * // Lista de skills/habilidades
 * <View>
 *   <ProgressBar label="JavaScript" value={90} variant="success" showPercentage />
 *   <ProgressBar label="React" value={85} variant="success" showPercentage />
 *   <ProgressBar label="Python" value={70} variant="info" showPercentage />
 * </View>
 */
export function ProgressBar({
  value = 0,
  max = 100,
  label,
  showPercentage = false,
  variant = "default",
  size = "md",
  striped = false,
  animated = false,
  style,
}) {
  const { theme } = useTheme();

  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  // Colores por variant
  const variantColors = {
    default: theme.colors.text.secondary,
    primary: theme.colors.brand.primary,
    success: theme.colors.status.success,
    warning: theme.colors.status.warning,
    danger: theme.colors.status.error,
    info: theme.colors.status.info,
  };

  const barColor = variantColors[variant] || variantColors.default;

  // Tamaños
  const sizeStyles = {
    sm: { height: 4 },
    md: { height: 8 },
    lg: { height: 12 },
  };

  return (
    <View style={[styles.container, style]}>
      {(label || showPercentage) && (
        <View style={styles.header}>
          {label && (
            <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
              {label}
            </Text>
          )}
          {showPercentage && (
            <Text style={[styles.percentage, { color: theme.colors.text.primary }]}>
              {Math.round(percentage)}%
            </Text>
          )}
        </View>
      )}

      <View
        style={[
          styles.track,
          sizeStyles[size],
          { backgroundColor: theme.colors.background.hover },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${percentage}%`,
              backgroundColor: barColor,
            },
            striped && styles.striped,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
  percentage: {
    fontSize: 13,
    fontWeight: "700",
  },
  track: {
    width: "100%",
    borderRadius: DESIGN_TOKENS.borderRadius.round,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: DESIGN_TOKENS.borderRadius.round,
  },
  striped: {
    // Rayado (simplificado para React Native)
    opacity: 0.8,
  },
});

export default ProgressBar;
