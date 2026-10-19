import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Card reutilizable con variants de estilo y color
 * 
 * Componente de tarjeta flexible con múltiples variantes visuales (estilo y color),
 * padding configurable, headers/footers opcionales, y soporte para interacción.
 * 
 * @param {('default'|'elevated'|'outlined'|'flat')} variant - Variante de estilo visual
 * @param {('default'|'primary'|'success'|'warning'|'danger'|'info')} color - Variante de color (opcional)
 * @param {('none'|'sm'|'md'|'lg'|number)} padding - Padding interno del contenido
 * @param {function} onPress - Callback si la card es clickeable
 * @param {ReactNode} header - Contenido del header (con borde inferior)
 * @param {ReactNode} footer - Contenido del footer (con borde superior)
 * @param {ReactNode} children - Contenido principal
 * @param {object} style - Estilos adicionales del contenedor
 * @param {object} contentStyle - Estilos adicionales del contenido
 * 
 * @example
 * // Card básica
 * <Card>
 *   <Text>Contenido</Text>
 * </Card>
 * 
 * @example
 * // Card elevada con header y footer
 * <Card variant="elevated" header={<Text>Header</Text>} footer={<Button>Acción</Button>}>
 *   <Text>Contenido principal</Text>
 * </Card>
 * 
 * @example
 * // Card con color
 * <Card color="success">
 *   <Text>Operación exitosa</Text>
 * </Card>
 * 
 * @example
 * // Card clickeable
 * <Card onPress={() => navigate('Detail')}>
 *   <Text>Click aquí</Text>
 * </Card>
 * 
 * @example
 * // Card con padding custom
 * <Card padding={20}>
 *   <Text>Padding exacto de 20px</Text>
 * </Card>
 */
export function Card({
  variant = "default",
  color = "default",
  padding = "md",
  onPress,
  header,
  footer,
  children,
  style,
  contentStyle,
  ...props
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  // Variantes de estilo (apariencia visual)
  const variantStyles = {
    default: {
      backgroundColor: c.background.surface,
      ...DESIGN_TOKENS.shadows.sm,
    },
    elevated: {
      backgroundColor: c.background.elevated,
      ...DESIGN_TOKENS.shadows.md,
    },
    outlined: {
      backgroundColor: c.background.surface,
      borderWidth: 1,
      borderColor: c.border.primary,
    },
    flat: {
      backgroundColor: c.background.surface,
      // Sin sombra ni borde
    },
  };

  // Variantes de color (acento)
  const colorConfig = {
    default: {
      borderLeftWidth: 0,
      backgroundColor: null, // Usa el del variant
    },
    primary: {
      borderLeftWidth: 4,
      borderLeftColor: c.brand.primary,
      backgroundColor: c.brand.primaryLight || variantStyles[variant].backgroundColor,
    },
    success: {
      borderLeftWidth: 4,
      borderLeftColor: c.status.success,
      backgroundColor: c.status.successLight || variantStyles[variant].backgroundColor,
    },
    warning: {
      borderLeftWidth: 4,
      borderLeftColor: c.status.warning,
      backgroundColor: c.status.warningLight || variantStyles[variant].backgroundColor,
    },
    danger: {
      borderLeftWidth: 4,
      borderLeftColor: c.status.error,
      backgroundColor: c.status.errorLight || variantStyles[variant].backgroundColor,
    },
    info: {
      borderLeftWidth: 4,
      borderLeftColor: c.brand.primary,
      backgroundColor: c.brand.primaryLight || variantStyles[variant].backgroundColor,
    },
  };

  const currentColorConfig = colorConfig[color] || colorConfig.default;

  // Padding (puede ser string preset o número)
  const paddingStyles = typeof padding === "number"
    ? { padding }
    : {
        none: { padding: 0 },
        sm: { padding: DESIGN_TOKENS.spacing.sm },
        md: { padding: DESIGN_TOKENS.spacing.md },
        lg: { padding: DESIGN_TOKENS.spacing.lg },
      }[padding] || { padding: DESIGN_TOKENS.spacing.md };

  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      onPress={onPress}
      style={[
        styles.card,
        variantStyles[variant],
        currentColorConfig.borderLeftWidth > 0 && {
          borderLeftWidth: currentColorConfig.borderLeftWidth,
          borderLeftColor: currentColorConfig.borderLeftColor,
        },
        currentColorConfig.backgroundColor && {
          backgroundColor: currentColorConfig.backgroundColor,
        },
        style,
      ]}
      activeOpacity={onPress ? 0.7 : 1}
      {...props}
    >
      {header && (
        <View style={[styles.header, { borderBottomColor: c.border.primary }]}>
          {header}
        </View>
      )}
      
      <View style={[paddingStyles, contentStyle]}>
        {children}
      </View>
      
      {footer && (
        <View style={[styles.footer, { borderTopColor: c.border.primary }]}>
          {footer}
        </View>
      )}
    </Component>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: DESIGN_TOKENS.borderRadius.lg,
    overflow: "hidden",
  },
  header: {
    borderBottomWidth: 1,
    padding: DESIGN_TOKENS.spacing.md,
  },
  footer: {
    borderTopWidth: 1,
    padding: DESIGN_TOKENS.spacing.md,
  },
});

export default Card;
