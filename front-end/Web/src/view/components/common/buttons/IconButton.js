import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Botón circular solo con icono
 * 
 * @param {ReactNode} icon - Icono a mostrar
 * @param {string} variant - Estilo: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
 * @param {string} size - Tamaño: 'sm' | 'md' | 'lg'
 * @param {boolean} disabled - Deshabilita el botón
 * @param {function} onPress - Callback al presionar
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

  // Estilos por variante
  const variantStyles = {
    primary: {
      backgroundColor: theme.colors.brand.primary,
    },
    secondary: {
      backgroundColor: theme.colors.brand.secondary,
    },
    outline: {
      backgroundColor: "transparent",
      borderColor: theme.colors.brand.primary,
      borderWidth: 1,
    },
    ghost: {
      backgroundColor: "transparent",
    },
    danger: {
      backgroundColor: theme.colors.status.error,
    },
  };

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

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        variantStyles[variant],
        sizeStyles[size],
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: DESIGN_TOKENS.borderRadius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.5,
  },
});

export default IconButton;
