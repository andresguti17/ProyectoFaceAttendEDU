import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Skeleton placeholder component para estados de carga
 * 
 * Componente de loading placeholder animado que muestra dónde aparecerá el contenido.
 * Mejor experiencia de usuario que un spinner genérico. Incluye variants predefinidos
 * y sub-componentes para casos comunes (Text, Circle, Card, Avatar).
 * 
 * @param {('text'|'circle'|'rect')} variant - Tipo de skeleton
 * @param {number} width - Ancho del skeleton
 * @param {number} height - Altura del skeleton
 * @param {boolean} animated - Si debe animar (shimmer effect)
 * @param {number} borderRadius - Radio de borde custom
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * // Skeleton básico
 * <Skeleton width={200} height={20} />
 * 
 * @example
 * // Skeleton circular (avatar)
 * <Skeleton variant="circle" width={48} height={48} />
 * 
 * @example
 * // Sin animación
 * <Skeleton width={100} height={100} animated={false} />
 * 
 * @example
 * // Usando sub-componentes
 * <View>
 *   <Skeleton.Avatar />
 *   <Skeleton.Text width={120} />
 *   <Skeleton.Text width={200} />
 * </View>
 * 
 * @example
 * // Loading de card completa
 * <Skeleton.Card />
 */
export function Skeleton({
  variant = "rect",
  width = 100,
  height = 20,
  animated = true,
  borderRadius,
  style,
}) {
  const { theme } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animated, animatedValue]);

  const opacity = animated
    ? animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
      })
    : 0.3;

  const getVariantStyles = () => {
    switch (variant) {
      case "circle":
        return {
          width,
          height,
          borderRadius: width / 2,
        };
      case "text":
        return {
          width,
          height: height || 16,
          borderRadius: DESIGN_TOKENS.borderRadius.sm,
        };
      case "rect":
      default:
        return {
          width,
          height,
          borderRadius: borderRadius ?? DESIGN_TOKENS.borderRadius.md,
        };
    }
  };

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          backgroundColor: theme.colors.background.hover,
          opacity,
        },
        getVariantStyles(),
        style,
      ]}
    />
  );
}

/**
 * Skeleton.Text - Placeholder para líneas de texto
 * 
 * @example
 * <Skeleton.Text width={200} />
 * <Skeleton.Text width={150} />
 */
Skeleton.Text = function SkeletonText({ width = 200, height = 16, style, ...props }) {
  return (
    <Skeleton
      variant="text"
      width={width}
      height={height}
      style={[styles.text, style]}
      {...props}
    />
  );
};

/**
 * Skeleton.Circle - Placeholder circular (avatars, iconos)
 * 
 * @example
 * <Skeleton.Circle size={48} />
 */
Skeleton.Circle = function SkeletonCircle({ size = 48, style, ...props }) {
  return (
    <Skeleton
      variant="circle"
      width={size}
      height={size}
      style={style}
      {...props}
    />
  );
};

/**
 * Skeleton.Avatar - Alias de Circle para avatares
 * 
 * @example
 * <Skeleton.Avatar size={40} />
 */
Skeleton.Avatar = function SkeletonAvatar(props) {
  return <Skeleton.Circle {...props} />;
};

/**
 * Skeleton.Card - Placeholder de card completa (avatar + texto)
 * 
 * @example
 * <Skeleton.Card />
 */
Skeleton.Card = function SkeletonCard({ style, ...props }) {
  return (
    <View style={[styles.card, style]} {...props}>
      <Skeleton.Circle size={48} />
      <View style={styles.cardContent}>
        <Skeleton.Text width={120} height={14} />
        <Skeleton.Text width={200} height={12} style={styles.cardSecondaryText} />
      </View>
    </View>
  );
};

/**
 * Skeleton.List - Placeholder de lista de items
 * 
 * @example
 * <Skeleton.List items={5} />
 */
Skeleton.List = function SkeletonList({ items = 3, style, ...props }) {
  return (
    <View style={style} {...props}>
      {Array.from({ length: items }).map((_, index) => (
        <Skeleton.Card key={index} style={index < items - 1 && styles.listItem} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    overflow: "hidden",
  },
  text: {
    marginVertical: DESIGN_TOKENS.spacing.xs / 2,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: DESIGN_TOKENS.spacing.md,
  },
  cardContent: {
    flex: 1,
    marginLeft: DESIGN_TOKENS.spacing.md,
  },
  cardSecondaryText: {
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  listItem: {
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
});

export default Skeleton;
