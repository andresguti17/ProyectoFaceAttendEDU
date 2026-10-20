import React from "react";
import { Pressable, Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";
import { getButtonColors } from "./buttonColors";

/**
 * Botón reutilizable con variantes y tamaños
 *
 * Es el ÚNICO botón de acción de la app. Sus colores salen siempre de los
 * tokens del tema (ver buttonColors.js), es decir, de la paleta que el usuario
 * elige en Configuración > Apariencia: no se pasa color por `style`/`textStyle`.
 *
 * @param {('primary'|'secondary'|'outline'|'ghost'|'danger'|'success'|'warning'|'inverse'|'inverseOutline')} variant - Variante visual (inverse* para fondos de marca)
 * @param {('sm'|'md'|'lg')} size - Tamaño del botón
 * @param {boolean} fullWidth - Si debe ocupar todo el ancho disponible
 * @param {boolean} loading - Muestra spinner de carga (bloquea la pulsación)
 * @param {boolean} disabled - Deshabilita el botón
 * @param {ReactNode} leftIcon - Icono a la izquierda del texto
 * @param {ReactNode} rightIcon - Icono a la derecha del texto
 * @param {function} onPress - Callback al presionar el botón
 * @param {string|ReactNode} children - Contenido del botón (texto o componente)
 * @param {object} style - Estilos de layout adicionales del contenedor (márgenes, ancho)
 * @param {object} textStyle - Estilos de texto adicionales (tipografía, no color)
 * @param {object} themeColors - Paleta alternativa (theme.colors); solo la usa la vista previa de Configuración
 *
 * @example
 * <Button variant="primary" onPress={handleSave}>Guardar</Button>
 *
 * @example
 * // Con icono: el color del icono es el del texto de la variante
 * <Button variant="outline" leftIcon={<Feather name="save" size={16} color={theme.colors.brand.primary} />}>
 *   Guardar
 * </Button>
 *
 * @example
 * <Button variant="danger" size="sm" onPress={confirmDelete}>Eliminar</Button>
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
  themeColors,
  ...props
}) {
  const { theme } = useTheme();
  const palette = themeColors ?? theme.colors;

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

  // Mientras carga se conservan los colores de la variante (no se ve "apagado"),
  // aunque quien llama pase también `disabled` para bloquear la pulsación.
  const looksDisabled = disabled && !loading;
  const idle = getButtonColors(palette, variant, { disabled: looksDisabled });
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ hovered, pressed }) => {
        const state = getButtonColors(palette, variant, { disabled: looksDisabled, hovered, pressed });
        return [
          styles.button,
          {
            backgroundColor: state.backgroundColor,
            borderColor: state.borderColor,
            borderWidth: variant === "ghost" ? 0 : 2,
            opacity: state.opacity,
          },
          sizeStyles[size],
          iconPaddingAdjustment,
          fullWidth && styles.fullWidth,
          style,
        ];
      }}
      {...props}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={idle.color}
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
                  { color: idle.color },
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
    </Pressable>
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
