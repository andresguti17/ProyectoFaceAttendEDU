import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { ChoiceError, ChoiceText, choiceActiveColor } from "./choiceParts";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Checkbox reutilizable con soporte para estados indeterminados, labels y variantes
 * 
 * Componente de checkbox altamente configurable que soporta tres estados (checked, unchecked, indeterminate),
 * múltiples variantes visuales, labels opcionales, estados de error y disabled.
 * 
 * @param {boolean} checked - Si el checkbox está marcado
 * @param {function} onToggle - Callback al cambiar estado (recibe nuevo valor boolean)
 * @param {('default'|'primary'|'success'|'warning'|'danger')} variant - Variante visual del checkbox
 * @param {('sm'|'md'|'lg')} size - Tamaño del checkbox
 * @param {string|ReactNode} label - Texto o elemento a la derecha del checkbox
 * @param {string} description - Texto descriptivo debajo del label
 * @param {boolean} indeterminate - Estado indeterminado (para checkboxes "select all")
 * @param {boolean} disabled - Si está deshabilitado
 * @param {boolean} error - Si hay error
 * @param {string} errorMessage - Mensaje de error
 * @param {object} style - Estilos adicionales del contenedor
 * @param {object} checkboxStyle - Estilos adicionales del checkbox
 * @param {object} labelStyle - Estilos adicionales del label
 * 
 * @example
 * // Checkbox básico
 * <Checkbox 
 *   checked={agreed} 
 *   onToggle={setAgreed}
 *   label="Acepto los términos y condiciones"
 * />
 * 
 * @example
 * // Checkbox con descripción
 * <Checkbox 
 *   checked={notifications}
 *   onToggle={setNotifications}
 *   label="Notificaciones por email"
 *   description="Recibe alertas sobre asistencia y reportes"
 * />
 * 
 * @example
 * // Checkbox indeterminado (select all)
 * <Checkbox 
 *   checked={allSelected}
 *   indeterminate={someSelected && !allSelected}
 *   onToggle={toggleSelectAll}
 *   label="Seleccionar todos"
 * />
 * 
 * @example
 * // Checkbox con error
 * <Checkbox 
 *   checked={agreed}
 *   onToggle={setAgreed}
 *   label="Acepto los términos"
 *   error={submitted && !agreed}
 *   errorMessage="Debes aceptar los términos para continuar"
 * />
 * 
 * @example
 * // Checkbox con variant
 * <Checkbox 
 *   checked={isActive}
 *   onToggle={setIsActive}
 *   label="Estudiante activo"
 *   variant="success"
 * />
 */
export function Checkbox({
  checked = false,
  onToggle,
  variant = "default",
  size = "md",
  label,
  description,
  indeterminate = false,
  disabled = false,
  error = false,
  errorMessage,
  style,
  checkboxStyle,
  labelStyle,
  ...props
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.colors;

  // Tamaños
  const sizeConfig = {
    sm: { box: 16, icon: 12, labelSize: 13 },
    md: { box: 20, icon: 14, labelSize: 14 },
    lg: { box: 24, icon: 16, labelSize: 15 },
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;

  // Color de la marca sobre el relleno: el "texto sobre" del mismo token del tema.
  const markColors = {
    default: c.brand.textOnPrimary,
    primary: c.brand.textOnPrimary,
    success: c.status.successText,
    warning: c.status.warningText,
    danger: c.status.errorText,
  };
  const markColor = error
    ? c.status.errorText
    : markColors[variant] || markColors.default;

  const activeColor = choiceActiveColor(c, variant, error);

  // Estados del checkbox
  const isChecked = checked || indeterminate;
  const backgroundColor = disabled
    ? c.interactive.disabled
    : isChecked
    ? activeColor
    : "transparent";

  const borderColor = disabled
    ? c.border.primary
    : error
    ? c.status.danger
    : isChecked
    ? activeColor
    : c.border.primary;

  // Icono según estado
  const getIcon = () => {
    if (indeterminate) return "minus";
    if (checked) return "check";
    return null;
  };

  const handlePress = () => {
    if (!disabled && onToggle) {
      // Si está indeterminado, al hacer toggle pasa a checked
      if (indeterminate) {
        onToggle(true);
      } else {
        onToggle(!checked);
      }
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
        {/* Checkbox box */}
        <View
          style={[
            styles.checkbox,
            {
              width: currentSize.box,
              height: currentSize.box,
              backgroundColor,
              borderColor,
              borderWidth: 2,
              borderRadius: DESIGN_TOKENS.borderRadius.sm,
              opacity: disabled ? 0.5 : 1,
            },
            checkboxStyle,
          ]}
        >
          {getIcon() && (
            <Feather
              name={getIcon()}
              size={currentSize.icon}
              color={disabled ? c.interactive.disabledText : markColor}
            />
          )}
        </View>

        {/* Label y descripción */}
        <ChoiceText
          c={c}
          label={label}
          description={description}
          labelSize={currentSize.labelSize}
          disabled={disabled}
          error={error}
          labelStyle={labelStyle}
          containerStyle={styles.textContainer}
        />
      </TouchableOpacity>

      {/* Error message */}
      <ChoiceError c={c} message={error ? errorMessage : null} labelSize={currentSize.labelSize} offset={currentSize.box + 8} t={t} />
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
  checkbox: {
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    marginLeft: 8,
    justifyContent: "center",
  },
});

export default Checkbox;
