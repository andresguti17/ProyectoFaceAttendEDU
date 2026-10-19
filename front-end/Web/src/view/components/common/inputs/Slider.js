import React from "react";
import { View, Text, StyleSheet } from "react-native";
import RNSlider from "@react-native-community/slider";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Slider component para selección de valores numéricos
 * 
 * Wrapper theme-aware del Slider nativo con labels y visualización de valor.
 * Ideal para ajustes numéricos, rangos y configuraciones.
 * 
 * @param {number} value - Valor actual del slider
 * @param {function} onValueChange - Callback al cambiar valor
 * @param {number} min - Valor mínimo (default: 0)
 * @param {number} max - Valor máximo (default: 100)
 * @param {number} step - Incremento (default: 1)
 * @param {string} label - Etiqueta del slider
 * @param {boolean} showValue - Mostrar valor actual (default: true)
 * @param {function} formatValue - Función para formatear el valor mostrado
 * @param {boolean} disabled - Si está deshabilitado
 * @param {object} style - Estilos adicionales del contenedor
 * 
 * @example
 * // Slider básico
 * const [volume, setVolume] = useState(50);
 * <Slider
 *   label="Volumen"
 *   value={volume}
 *   onValueChange={setVolume}
 *   min={0}
 *   max={100}
 * />
 * 
 * @example
 * // Con formato personalizado
 * <Slider
 *   label="Descuento"
 *   value={discount}
 *   onValueChange={setDiscount}
 *   min={0}
 *   max={100}
 *   formatValue={(val) => `${val}%`}
 * />
 * 
 * @example
 * // Rango de edad
 * <Slider
 *   label="Edad mínima"
 *   value={minAge}
 *   onValueChange={setMinAge}
 *   min={18}
 *   max={65}
 *   step={1}
 *   formatValue={(val) => `${val} años`}
 * />
 * 
 * @example
 * // Porcentaje de asistencia mínima
 * <Slider
 *   label="Asistencia mínima requerida"
 *   value={minAttendance}
 *   onValueChange={setMinAttendance}
 *   min={50}
 *   max={100}
 *   step={5}
 *   formatValue={(val) => `${val}%`}
 * />
 * 
 * @example
 * // Sin mostrar valor
 * <Slider
 *   label="Dificultad"
 *   value={difficulty}
 *   onValueChange={setDifficulty}
 *   min={1}
 *   max={5}
 *   showValue={false}
 * />
 */
export function Slider({
  value = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  formatValue,
  disabled = false,
  style,
  ...props
}) {
  const { theme } = useTheme();

  const displayValue = formatValue ? formatValue(value) : value;

  return (
    <View style={[styles.container, style]}>
      {(label || showValue) && (
        <View style={styles.header}>
          {label && (
            <Text
              style={[
                styles.label,
                {
                  color: disabled
                    ? theme.colors.text.disabled
                    : theme.colors.text.secondary,
                },
              ]}
            >
              {label}
            </Text>
          )}
          {showValue && (
            <Text
              style={[
                styles.value,
                {
                  color: disabled
                    ? theme.colors.text.disabled
                    : theme.colors.brand.primary,
                },
              ]}
            >
              {displayValue}
            </Text>
          )}
        </View>
      )}

      <RNSlider
        value={value}
        onValueChange={onValueChange}
        minimumValue={min}
        maximumValue={max}
        step={step}
        disabled={disabled}
        minimumTrackTintColor={
          disabled ? theme.colors.text.disabled : theme.colors.brand.primary
        }
        maximumTrackTintColor={theme.colors.border.primary}
        thumbTintColor={
          disabled ? theme.colors.text.disabled : theme.colors.brand.primary
        }
        style={styles.slider}
        {...props}
      />

      <View style={styles.minMaxLabels}>
        <Text
          style={[
            styles.minMaxText,
            {
              color: disabled
                ? theme.colors.text.disabled
                : theme.colors.text.tertiary,
            },
          ]}
        >
          {formatValue ? formatValue(min) : min}
        </Text>
        <Text
          style={[
            styles.minMaxText,
            {
              color: disabled
                ? theme.colors.text.disabled
                : theme.colors.text.tertiary,
            },
          ]}
        >
          {formatValue ? formatValue(max) : max}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  value: {
    fontSize: 14,
    fontWeight: "700",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  minMaxLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -DESIGN_TOKENS.spacing.xs,
  },
  minMaxText: {
    fontSize: 11,
  },
});

export default Slider;
