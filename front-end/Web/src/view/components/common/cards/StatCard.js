import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card } from "./Card";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Card para mostrar estadísticas/métricas
 * 
 * @param {string} label - Etiqueta de la métrica
 * @param {string|number} value - Valor de la métrica
 * @param {ReactNode} icon - Icono opcional
 * @param {string} trend - Tendencia: 'up' | 'down' | 'neutral'
 * @param {string} trendValue - Valor de la tendencia (ej: "+12%")
 * @param {string} color - Color de acento
 */
export function StatCard({
  label,
  value,
  icon,
  trend,
  trendValue,
  color,
  onPress,
  style,
}) {
  const { theme } = useTheme();

  const trendColors = {
    up: theme.colors.status.success,
    down: theme.colors.status.error,
    neutral: theme.colors.text.secondary,
  };

  const trendIcons = {
    up: "↗",
    down: "↘",
    neutral: "→",
  };

  return (
    <Card variant="elevated" padding="md" onPress={onPress} style={style}>
      <View style={styles.container}>
        <View style={styles.header}>
          {icon && (
            <View style={[styles.iconContainer, color && { backgroundColor: color + "20" }]}>
              {icon}
            </View>
          )}
          <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
            {label}
          </Text>
          
          {/* Trend/Badge al lado derecho del título */}
          {trend && (
            <Text style={[styles.trendText, { color: trendColors[trend], marginLeft: "auto" }]}>
              {trendIcons[trend]} {trendValue}
            </Text>
          )}
        </View>

        <Text style={[styles.value, { color: theme.colors.text.primary }]}>
          {value}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: DESIGN_TOKENS.spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: DESIGN_TOKENS.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  value: {
    fontSize: 28,
    fontWeight: "800",
  },
  trendText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

export default StatCard;
