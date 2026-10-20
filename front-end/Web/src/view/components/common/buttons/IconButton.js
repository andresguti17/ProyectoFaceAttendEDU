import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";
import { getButtonColors } from "./buttonColors";

/**
 * Botón circular solo con icono
 *
 * Usa los mismos colores que Button (ver buttonColors.js). Para que el icono
 * tome el color correcto de la variante, `icon` puede ser una función que
 * recibe ese color: `icon={(color) => <Feather name="edit" size={18} color={color} />}`.
 *
 * @param {ReactNode|function(string): ReactNode} icon - Icono, o función que lo crea con el color de la variante
 * @param {string} variant - 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning' | 'inverse' | 'inverseOutline'
 * @param {string} size - Tamaño: 'sm' | 'md' | 'lg'
 * @param {boolean} disabled - Deshabilita el botón
 * @param {function} onPress - Callback al presionar
 * @param {string} accessibilityLabel - Etiqueta accesible (recomendada: no hay texto)
 */
export function IconButton({
  icon,
  variant = "ghost",
  size = "md",
  disabled = false,
  onPress,
  style,
  ...props
}) {
  const { theme } = useTheme();

  // Tamaños
  const sizeStyles = {
    sm: {
      width: 32,
      height: 32,
    },
    md: {
      width: 40,
      height: 40,
    },
    lg: {
      width: 48,
      height: 48,
    },
  };

  const idle = getButtonColors(theme.colors, variant, { disabled });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ hovered, pressed }) => {
        const state = getButtonColors(theme.colors, variant, { disabled, hovered, pressed });
        return [
          styles.button,
          {
            backgroundColor: state.backgroundColor,
            borderColor: state.borderColor,
            borderWidth: variant === "outline" ? 1 : 0,
            opacity: state.opacity,
          },
          sizeStyles[size],
          style,
        ];
      }}
      {...props}
    >
      {typeof icon === "function" ? icon(idle.color) : icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: DESIGN_TOKENS.borderRadius.round,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default IconButton;
