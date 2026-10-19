import React, { useRef, useEffect } from "react";
import { View, Text, TextInput as RNTextInput, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Input de texto reutilizable con label, error, success, warning, progress y hint
 * 
 * @param {string} label - Etiqueta del input
 * @param {string} value - Valor del input
 * @param {function} onChangeText - Callback al cambiar texto
 * @param {string} placeholder - Placeholder
 * @param {string} type - Tipo: 'text' | 'email' | 'password' | 'number' | 'phone'
 * @param {boolean} error - Si hay error (rojo)
 * @param {string} errorMessage - Mensaje de error
 * @param {boolean} success - Si es válido (verde)
 * @param {boolean} warning - Si hay advertencia (naranja)
 * @param {number} progress - Progreso de validación (0-100) para animación progress bar
 * @param {string} helperText - Texto de ayuda
 * @param {boolean} required - Si es requerido
 * @param {boolean} disabled - Si está deshabilitado
 * @param {boolean} multiline - Si es multilinea
 * @param {number} numberOfLines - Número de líneas (multiline)
 * @param {ReactNode} leftIcon - Icono izquierdo
 * @param {ReactNode} rightIcon - Icono derecho
 * @param {boolean} shake - Trigger para animación shake
 */
export function TextInput({
  label,
  value,
  onChangeText,
  placeholder,
  type = "text",
  error = false,
  errorMessage,
  success = false,
  warning = false,
  progress = 0,
  helperText,
  required = false,
  disabled = false,
  multiline = false,
  numberOfLines = 3,
  leftIcon,
  rightIcon,
  style,
  inputStyle,
  containerStyle,
  shake = false,
  ...props
}) {
  const { theme } = useTheme();
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const [isFocused, setIsFocused] = React.useState(false);

  // Animación shake cuando hay error o warning
  useEffect(() => {
    if (shake && (error || warning)) {
      Animated.sequence([
        Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [shake, error, warning]);

  // Configuración por tipo
  const typeConfig = {
    text: { keyboardType: "default", secureTextEntry: false },
    email: { keyboardType: "email-address", secureTextEntry: false, autoCapitalize: "none" },
    password: { keyboardType: "default", secureTextEntry: true, autoCapitalize: "none" },
    number: { keyboardType: "numeric", secureTextEntry: false },
    phone: { keyboardType: "phone-pad", secureTextEntry: false },
  };

  const config = typeConfig[type] || typeConfig.text;

  // Determinar color del borde
  const getBorderColor = () => {
    if (error) return theme.colors.status.error;
    if (warning) return theme.colors.status.warning;
    if (success) return theme.colors.status.success;
    if (isFocused) return theme.colors.text.primary; // Negro sólido al enfocar
    // Borde semi-transparente en reposo (igual que SearchBar)
    return theme.colors.border.primary + '80'; // 50% opacidad
  };

  // Determinar color del label
  const getLabelColor = () => {
    if (error) return theme.colors.status.error;
    if (warning) return theme.colors.status.warning;
    if (success) return theme.colors.status.success;
    return theme.colors.text.secondary;
  };

  // Estado de progreso activo
  const isProgressing = progress > 0 && progress < 100;

  return (
    <Animated.View 
      style={[
        styles.container, 
        style,
        { transform: [{ translateX: shakeAnimation }] }
      ]}
    >
      {label && (
        <Text
          style={[
            styles.label,
            { color: getLabelColor() },
          ]}
        >
          {label}
          {required && <Text style={{ color: theme.colors.status.error }}> *</Text>}
        </Text>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            borderColor: getBorderColor(),
            borderWidth: 2, // SIEMPRE 2px para evitar "baile" al hacer focus
            backgroundColor: disabled
              ? theme.colors.background.hover
              : theme.colors.background.surface,
            overflow: 'hidden',
            position: 'relative',
            // Ajustar padding derecho si hay rightIcon
            paddingRight: rightIcon || success ? 40 : DESIGN_TOKENS.spacing.sm,
          },
          multiline && { height: 'auto', minHeight: 80, alignItems: 'flex-start' },
          containerStyle, // Permite sobrescribir height desde fuera
        ]}
      >
        {/* Progress bar animado en el borde */}
        {isProgressing && (
          <View 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${progress}%`,
              backgroundColor: theme.colors.brand.primaryLight,
              opacity: 0.3,
              zIndex: 0,
            }}
          />
        )}

        {leftIcon && <View style={[styles.leftIcon, { zIndex: 1 }]}>{leftIcon}</View>}

        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.disabled}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              color: theme.colors.text.primary,
              textAlignVertical: multiline ? "top" : "center",
            },
            multiline && { minHeight: 80, paddingVertical: DESIGN_TOKENS.spacing.sm + 2 },
            inputStyle,
          ]}
          {...config}
          {...props}
        />

        {rightIcon && <View style={[styles.rightIcon, { zIndex: 1 }]}>{rightIcon}</View>}
        
        {/* Checkmark verde cuando es válido */}
        {success && !rightIcon && (
          <View style={[styles.rightIcon, { zIndex: 1 }]}>
            <Feather name="check-circle" size={20} color={theme.colors.status.success} />
          </View>
        )}
      </View>

      {/* Mensaje de error (normal) */}
      {error && errorMessage && (
        <Text style={[styles.message, { color: theme.colors.status.error }]}>
          {errorMessage}
        </Text>
      )}

      {/* Helper text - posicionado absolutamente para NO afectar el layout */}
      {!error && helperText && (
        <Text style={[styles.helperText, { color: theme.colors.text.secondary }]}>
          {helperText}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
    position: 'relative', // Para que el helperText se posicione respecto a este contenedor
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: DESIGN_TOKENS.borderRadius.lg,
    paddingLeft: DESIGN_TOKENS.spacing.sm,
    paddingRight: DESIGN_TOKENS.spacing.sm,
    height: 48,
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    height: '100%',
    outlineWidth: 0,
    outlineStyle: 'none',
    flexShrink: 1,
    minWidth: 0,
  },
  leftIcon: {
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  rightIcon: {
    marginLeft: DESIGN_TOKENS.spacing.sm + 2,
  },
  message: {
    fontSize: 12,
    marginTop: 3,
  },
  helperText: {
    fontSize: 11,
    position: 'absolute',
    top: '100%', // Justo debajo del input
    left: 0,
    marginTop: 2,
    opacity: 0.8,
  },
});

export default TextInput;
