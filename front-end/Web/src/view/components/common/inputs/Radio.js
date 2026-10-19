import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Radio button individual
 * 
 * Componente de radio button para selección única. Normalmente usado dentro de RadioGroup.
 * 
 * @param {boolean} selected - Si el radio está seleccionado
 * @param {function} onPress - Callback al presionar
 * @param {('default'|'primary'|'success'|'warning'|'danger')} variant - Variante visual
 * @param {('sm'|'md'|'lg')} size - Tamaño del radio
 * @param {string|ReactNode} label - Texto o elemento del label
 * @param {string} description - Texto descriptivo debajo del label
 * @param {boolean} disabled - Si está deshabilitado
 * @param {boolean} error - Si hay error
 * @param {object} style - Estilos adicionales del contenedor
 * @param {object} radioStyle - Estilos adicionales del radio
 * @param {object} labelStyle - Estilos adicionales del label
 * 
 * @example
 * // Radio básico
 * <Radio 
 *   selected={value === 'option1'}
 *   onPress={() => setValue('option1')}
 *   label="Opción 1"
 * />
 * 
 * @example
 * // Radio con descripción
 * <Radio 
 *   selected={plan === 'premium'}
 *   onPress={() => setPlan('premium')}
 *   label="Plan Premium"
 *   description="Acceso completo a todas las funcionalidades"
 * />
 */
export function Radio({
  selected = false,
  onPress,
  variant = "default",
  size = "md",
  label,
  description,
  disabled = false,
  error = false,
  style,
  radioStyle,
  labelStyle,
  ...props
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  // Tamaños
  const sizeConfig = {
    sm: { outer: 16, inner: 8, labelSize: 13 },
    md: { outer: 20, inner: 10, labelSize: 14 },
    lg: { outer: 24, inner: 12, labelSize: 15 },
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;

  // Colores por variant
  const variantColors = {
    default: c.brand.primary,
    primary: c.brand.primary,
    success: c.status.success,
    warning: c.status.warning,
    danger: c.status.danger,
  };

  const activeColor = error 
    ? c.status.danger 
    : variantColors[variant] || variantColors.default;

  const borderColor = disabled
    ? c.border.primary
    : error
    ? c.status.danger
    : selected
    ? activeColor
    : c.border.primary;

  const handlePress = () => {
    if (!disabled && onPress) {
      onPress();
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
        style={styles.row}
        {...props}
      >
        {/* Radio circle */}
        <View
          style={[
            styles.radioOuter,
            {
              width: currentSize.outer,
              height: currentSize.outer,
              borderColor,
              borderWidth: 2,
              borderRadius: currentSize.outer / 2,
              opacity: disabled ? 0.5 : 1,
            },
            radioStyle,
          ]}
        >
          {selected && (
            <View
              style={[
                styles.radioInner,
                {
                  width: currentSize.inner,
                  height: currentSize.inner,
                  borderRadius: currentSize.inner / 2,
                  backgroundColor: disabled ? c.text.disabled : activeColor,
                },
              ]}
            />
          )}
        </View>

        {/* Label y descripción */}
        {(label || description) && (
          <View style={styles.textContainer}>
            {label && (
              <Text
                style={[
                  styles.label,
                  {
                    fontSize: currentSize.labelSize,
                    color: disabled
                      ? c.text.disabled
                      : error
                      ? c.status.danger
                      : c.text.primary,
                    fontWeight: "500",
                  },
                  labelStyle,
                ]}
              >
                {label}
              </Text>
            )}
            {description && (
              <Text
                style={[
                  styles.description,
                  {
                    fontSize: currentSize.labelSize - 1,
                    color: disabled ? c.text.disabled : c.text.secondary,
                    marginTop: 2,
                  },
                ]}
              >
                {description}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: DESIGN_TOKENS.spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  radioOuter: {
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {},
  textContainer: {
    flex: 1,
    marginLeft: 8,
    justifyContent: "center",
  },
  label: {
    lineHeight: 20,
  },
  description: {
    lineHeight: 18,
  },
});

export default Radio;
