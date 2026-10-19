import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Badge reutilizable con soporte para iconos, interacción y dot indicator
 * 
 * Componente de badge flexible con múltiples variantes, tamaños, iconos opcionales,
 * interacción (clickeable) y dot indicator para notificaciones.
 * 
 * @param {('default'|'primary'|'success'|'warning'|'danger'|'info')} variant - Variante de color
 * @param {('sm'|'md'|'lg')} size - Tamaño del badge
 * @param {boolean} rounded - Si tiene bordes completamente redondeados
 * @param {string|ReactNode} icon - Icono Feather o componente custom
 * @param {('left'|'right')} iconPosition - Posición del icono respecto al texto
 * @param {boolean} dot - Muestra un punto indicador (para notificaciones)
 * @param {function} onPress - Callback si el badge es clickeable
 * @param {ReactNode} children - Contenido del badge (texto)
 * @param {object} style - Estilos adicionales del contenedor
 * @param {object} textStyle - Estilos adicionales del texto
 * 
 * @example
 * // Badge básico
 * <Badge variant="success">Activo</Badge>
 * 
 * @example
 * // Badge con icono
 * <Badge variant="warning" icon="alert-triangle">
 *   Alerta
 * </Badge>
 * 
 * @example
 * // Badge con dot (notificaciones)
 * <Badge variant="danger" dot>
 *   3 nuevos
 * </Badge>
 * 
 * @example
 * // Badge clickeable
 * <Badge variant="primary" onPress={() => showDetails()}>
 *   Ver detalles
 * </Badge>
 * 
 * @example
 * // Badge solo icono (sin texto)
 * <Badge variant="success" icon="check" />
 */
export function Badge({
  variant = "default",
  size = "md",
  rounded = true,
  icon,
  iconPosition = "left",
  dot = false,
  onPress,
  children,
  style,
  textStyle,
  ...props
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  // Colores por variant
  const variantStyles = {
    default: {
      backgroundColor: c.background.hover,
      color: c.text.primary,
    },
    primary: {
      backgroundColor: c.brand.primaryLight || "#DBEAFE",
      color: c.brand.primary,
    },
    success: {
      backgroundColor: c.status.successLight || "#D1FAE5",
      color: c.status.success,
    },
    warning: {
      backgroundColor: c.status.warningLight || "#FEF3C7",
      color: c.status.warning,
    },
    danger: {
      backgroundColor: c.status.dangerLight || "#FEE2E2",
      color: c.status.danger,
    },
    info: {
      backgroundColor: c.brand.primaryLight || "#DBEAFE",
      color: c.brand.primary,
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.default;

  // Tamaños
  const sizeStyles = {
    sm: {
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: 2,
      fontSize: 10,
      iconSize: 10,
      gap: 4,
      dotSize: 6,
    },
    md: {
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 4,
      fontSize: 12,
      iconSize: 12,
      gap: 6,
      dotSize: 8,
    },
    lg: {
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      fontSize: 14,
      iconSize: 14,
      gap: 8,
      dotSize: 10,
    },
  };

  const currentSize = sizeStyles[size] || sizeStyles.md;

  // Renderizar icono
  const renderIcon = () => {
    if (!icon) return null;

    if (typeof icon === "string") {
      return (
        <Feather
          name={icon}
          size={currentSize.iconSize}
          color={currentVariant.color}
        />
      );
    }

    return icon;
  };

  // Renderizar dot
  const renderDot = () => {
    if (!dot) return null;

    return (
      <View
        style={[
          styles.dot,
          {
            width: currentSize.dotSize,
            height: currentSize.dotSize,
            backgroundColor: currentVariant.color,
          },
        ]}
      />
    );
  };

  const Component = onPress ? TouchableOpacity : View;

  // Solo icono sin texto
  const iconOnly = icon && !children;

  return (
    <Component
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[
        styles.badge,
        {
          backgroundColor: currentVariant.backgroundColor,
          borderRadius: rounded
            ? DESIGN_TOKENS.borderRadius.round
            : DESIGN_TOKENS.borderRadius.md,
          paddingHorizontal: iconOnly
            ? currentSize.paddingVertical + 2
            : currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
          gap: currentSize.gap,
        },
        style,
      ]}
      {...props}
    >
      {/* Dot (siempre a la izquierda) */}
      {renderDot()}

      {/* Icon left */}
      {icon && iconPosition === "left" && renderIcon()}

      {/* Texto */}
      {children && (
        <Text
          style={[
            styles.text,
            {
              color: currentVariant.color,
              fontSize: currentSize.fontSize,
            },
            textStyle,
          ]}
        >
          {children}
        </Text>
      )}

      {/* Icon right */}
      {icon && iconPosition === "right" && renderIcon()}
    </Component>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "600",
  },
  dot: {
    borderRadius: 999,
  },
});

export default Badge;
