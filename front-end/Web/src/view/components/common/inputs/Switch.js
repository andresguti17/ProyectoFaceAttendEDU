import React from "react";
import { View, Text, Switch as RNSwitch, StyleSheet, Platform } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Switch - Toggle on/off con theming consistente
 * 
 * Wrapper del Switch nativo de React Native con styling consistente del theme,
 * labels opcionales, estados de error y disabled.
 * 
 * @param {boolean} value - Si el switch está activo (on)
 * @param {function} onValueChange - Callback al cambiar valor (recibe boolean)
 * @param {('default'|'primary'|'success'|'warning'|'danger')} variant - Variante de color cuando está activo
 * @param {('sm'|'md'|'lg')} size - Tamaño del switch (solo afecta labels, el switch usa tamaño nativo)
 * @param {string|ReactNode} label - Label del switch
 * @param {string} description - Descripción debajo del label
 * @param {boolean} disabled - Si está deshabilitado
 * @param {boolean} error - Si hay error
 * @param {string} errorMessage - Mensaje de error
 * @param {object} style - Estilos adicionales del contenedor
 * @param {object} switchStyle - Estilos adicionales del switch
 * @param {object} labelStyle - Estilos adicionales del label
 * 
 * @example
 * // Switch básico
 * <Switch 
 *   value={isActive}
 *   onValueChange={setIsActive}
 *   label="Activo"
 * />
 * 
 * @example
 * // Switch con descripción
 * <Switch 
 *   value={notifications}
 *   onValueChange={setNotifications}
 *   label="Notificaciones"
 *   description="Recibe alertas por email"
 * />
 * 
 * @example
 * // Switch con variant
 * <Switch 
 *   value={isPublic}
 *   onValueChange={setIsPublic}
 *   label="Perfil público"
 *   variant="success"
 * />
 * 
 * @example
 * // Switch deshabilitado
 * <Switch 
 *   value={isPremium}
 *   onValueChange={setIsPremium}
 *   label="Funcionalidad Premium"
 *   disabled={!hasSubscription}
 *   description="Solo disponible en plan Pro"
 * />
 */
export function Switch({
  value = false,
  onValueChange,
  variant = "default",
  size = "md",
  label,
  description,
  disabled = false,
  error = false,
  errorMessage,
  style,
  switchStyle,
  labelStyle,
  ...props
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  // Tamaños (solo afectan labels, el switch usa tamaño nativo)
  const sizeConfig = {
    sm: { labelSize: 13 },
    md: { labelSize: 14 },
    lg: { labelSize: 15 },
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

  // Colores del switch según plataforma
  const trackColorFalse = c.interactive.disabled;
  const trackColorTrue = activeColor;
  
  // iOS usa thumbColor, Android usa colores del track
  const thumbColor = Platform.OS === "ios" 
    ? "#FFFFFF" 
    : value 
      ? "#FFFFFF" 
      : "#F3F4F6";

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        {/* Switch */}
        <RNSwitch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{
            false: trackColorFalse,
            true: trackColorTrue,
          }}
          thumbColor={thumbColor}
          ios_backgroundColor={trackColorFalse}
          style={[
            styles.switch,
            { opacity: disabled ? 0.5 : 1 },
            switchStyle,
          ]}
          {...props}
        />

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
      </View>

      {/* Error message */}
      {error && errorMessage && (
        <Text
          style={[
            styles.errorMessage,
            {
              fontSize: currentSize.labelSize - 1,
              color: c.status.danger,
              marginTop: 4,
              marginLeft: 56, // Ancho aproximado del switch + gap
            },
          ]}
        >
          {errorMessage}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: DESIGN_TOKENS.spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  switch: {
    // El switch usa su tamaño nativo
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  label: {
    lineHeight: 20,
  },
  description: {
    lineHeight: 18,
  },
  errorMessage: {
    lineHeight: 16,
  },
});

export default Switch;
