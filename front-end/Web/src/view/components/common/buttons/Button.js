import React from "react";
import { TouchableOpacity, Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Botón reutilizable con variantes y tamaños
 * 
 * Componente de botón flexible con múltiples variantes visuales, tamaños configurables,
 * estados de loading y disabled, y soporte para iconos izquierdo/derecho.
 * 
 * @param {('primary'|'secondary'|'outline'|'ghost'|'danger')} variant - Variante visual del botón
 * @param {('sm'|'md'|'lg')} size - Tamaño del botón
 * @param {boolean} fullWidth - Si debe ocupar todo el ancho disponible
 * @param {boolean} loading - Muestra spinner de carga
 * @param {boolean} disabled - Deshabilita el botón
 * @param {ReactNode} leftIcon - Icono a la izquierda del texto
 * @param {ReactNode} rightIcon - Icono a la derecha del texto
 * @param {function} onPress - Callback al presionar el botón
 * @param {string|ReactNode} children - Contenido del botón (texto o componente)
 * @param {object} style - Estilos adicionales del contenedor
 * @param {object} textStyle - Estilos adicionales del texto
 * 
 * @example
 * // Botón primario básico
 * <Button variant="primary" onPress={handleSave}>
 *   Guardar
 * </Button>
 * 
 * @example
 * // Botón con loading
 * <Button loading={isSaving} disabled={isSaving}>
 *   {isSaving ? "Guardando..." : "Guardar"}
 * </Button>
 * 
 * @example
 * // Botón con iconos
 * <Button 
 *   leftIcon={<Feather name="save" size={16} color="#fff" />}
 *   variant="primary"
 * >
 *   Guardar
 * </Button>
 * 
 * @example
 * // Botón outline con full width
 * <Button variant="outline" fullWidth onPress={handleCancel}>
 *   Cancelar
 * </Button>
 * 
 * @example
 * // Botón peligroso con confirmación
 * <Button 
 *   variant="danger" 
 *   size="sm"
 *   onPress={() => {
 *     Alert.alert("Confirmar", "¿Eliminar?", [
 *       { text: "Cancelar" },
 *       { text: "Eliminar", onPress: handleDelete }
 *     ]);
 *   }}
 * >
 *   Eliminar
 * </Button>
 */
export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  onPress,
  children,
  style,
  textStyle,
  ...props
}) {
  const { theme } = useTheme();

  // Estilos por variante
  const variantStyles = {
    primary: {
      backgroundColor: theme.colors.brand.primary,
      borderColor: theme.colors.brand.primary,
      borderWidth: 2,
    },
    secondary: {
      backgroundColor: theme.colors.brand.secondary,
      borderColor: theme.colors.brand.secondary,
      borderWidth: 2,
    },
    outline: {
      backgroundColor: "transparent",
      borderColor: theme.colors.brand.primary,
      borderWidth: 2,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 0,
    },
    danger: {
      backgroundColor: theme.colors.status.error,
      borderColor: theme.colors.status.error,
      borderWidth: 2,
    },
  };

  // Estilos de texto por variante
  const textVariantStyles = {
    primary: { color: theme.colors.brand.textOnPrimary },
    secondary: { color: theme.colors.brand.textOnPrimary }, // Usar el mismo que primary
    outline: { color: theme.colors.brand.primary },
    ghost: { color: theme.colors.text.primary },
    danger: { color: theme.colors.status.errorText },
  };

  // Estilos por tamaño
  const sizeStyles = {
    sm: {
      paddingVertical: DESIGN_TOKENS.spacing.xs + 2,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      minHeight: 36,
    },
    md: {
      paddingVertical: DESIGN_TOKENS.spacing.sm + 4,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      minHeight: 48,
    },
    lg: {
      paddingVertical: DESIGN_TOKENS.spacing.md,
      paddingHorizontal: DESIGN_TOKENS.spacing.xl,
      minHeight: 52,
    },
  };
  
  // Reducir padding izquierdo cuando hay leftIcon
  const iconPaddingAdjustment = leftIcon ? {
    paddingLeft: sizeStyles[size].paddingHorizontal * 0.6, // 40% menos padding izquierdo
  } : {};

  // Tamaño de texto por size (usando pesos consistentes)
  const textSizeStyles = {
    sm: { fontSize: 13, fontWeight: "600" },
    md: { fontSize: 15, fontWeight: "600" },
    lg: { fontSize: 17, fontWeight: "600" },
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        variantStyles[variant],
        sizeStyles[size],
        iconPaddingAdjustment,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={textVariantStyles[variant].color}
            style={styles.loader}
          />
        ) : (
          <>
            {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
            
            {typeof children === "string" ? (
              <Text
                style={[
                  styles.text,
                  textSizeStyles[size],
                  textVariantStyles[variant],
                  textStyle,
                ]}
              >
                {children}
              </Text>
            ) : (
              children
            )}
            
            {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: DESIGN_TOKENS.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: DESIGN_TOKENS.spacing.xs,
  },
  text: {
    textAlign: "center",
    // Asegurar que el texto no tenga lineHeight que lo desalinee
    includeFontPadding: false, // Android
    textAlignVertical: "center", // Android
    // Pequeño ajuste para compensar el descender de las fuentes
    marginTop: 1,
  },
  leftIcon: {
    // Ajustar posición vertical del ícono para alinearlo con cap-height del texto
    // El ícono debe estar en la mitad visual de la letra "N"
    marginTop: 3
  },
  rightIcon: {
    // Mismo ajuste para íconos a la derecha
    marginTop: 2,
  },
  loader: {
    marginHorizontal: DESIGN_TOKENS.spacing.sm,
  },
});

export default Button;
