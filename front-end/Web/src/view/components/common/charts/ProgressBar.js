import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Barra de progreso horizontal reutilizable
 * 
 * @param {number} value - Valor actual (0-100)
 * @param {number} max - Valor máximo (default: 100)
 * @param {string} label - Etiqueta opcional
 * @param {boolean} showValue - Mostrar valor numérico
 * @param {string} color - Color de la barra
 * @param {string} size - Tamaño: 'sm' | 'md' | 'lg'
 */
export function ProgressBar({
  value = 0,
  max = 100,
  label,
  showValue = false,
  color,
  size = "md",
  style,
}) {
  const { theme } = useTheme();

  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = color || theme.colors.brand.primary;

  const sizeStyles = {
    sm: { height: 4 },
    md: { height: 6 },
    lg: { height: 8 },
  };

  return (
    <View style={[styles.container, style]}>
      {(label || showValue) && (
        <View style={styles.header}>
          {label && (
            <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
              {label}
            </Text>
          )}
          {showValue && (
            <Text style={[styles.value, { color: theme.colors.text.primary }]}>
              {Math.round(percentage)}%
            </Text>
          )}
        </View>
      )}
      
      <View
        style={[
          styles.track,
          sizeStyles[size],
          { backgroundColor: theme.colors.border.primary },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${percentage}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  label: {
    fontSize: 13,
  },
  value: {
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
});

export default ProgressBar;
