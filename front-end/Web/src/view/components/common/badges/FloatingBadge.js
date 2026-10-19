import React from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { useFloatAnimation } from "../../hooks/useFloatAnimation";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";
import { getTypography } from "../../../../core/constants/typography";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Badge flotante con animación
 * Usado en hero/landing para badges decorativos
 * 
 * @param {string} label - Texto del badge
 * @param {string} icon - Emoji o icono
 * @param {number} delay - Delay de animación (ms)
 */
export function FloatingBadge({ label, icon, delay = 0, style }) {
  const translateY = useFloatAnimation(delay);
  const { fs, sp } = useResponsive();
  const { theme } = useTheme();
  const T = getTypography(fs);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background.surface,
          ...DESIGN_TOKENS.shadows.md,
        },
        { transform: [{ translateY }] },
        style,
      ]}
    >
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[T.badgeLabel, { color: theme.colors.text.primary }]}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.borderRadius.round,
    zIndex: 10, // Por encima de todo el contenido del hero
  },
  icon: {
    fontSize: 14,
  },
});

export default FloatingBadge;
