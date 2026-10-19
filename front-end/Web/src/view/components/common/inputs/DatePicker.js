import React, { useState } from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";
import { formatDate as formatDateWithConfig, formatTime as formatTimeWithConfig, formatDateTime as formatDateTimeWithConfig } from "../../../../core/constants/dateFormats";

/**
 * DatePicker component para selección de fechas
 * 
 * Wrapper del DateTimePicker nativo de @react-native-community con API
 * consistente y theme integration. Soporta iOS y Android con presentación
 * adaptada a cada plataforma.
 * 
 * @param {Date} value - Fecha seleccionada
 * @param {function} onChange - Callback al cambiar fecha (recibe Date object)
 * @param {string} label - Etiqueta del picker
 * @param {string} placeholder - Placeholder
 * @param {Date} minimumDate - Fecha mínima permitida
 * @param {Date} maximumDate - Fecha máxima permitida
 * @param {('date'|'datetime'|'time')} mode - Modo del picker
 * @param {boolean} error - Si hay error
 * @param {string} errorMessage - Mensaje de error
 * @param {boolean} disabled - Si está deshabilitado
 * @param {boolean} required - Si es requerido
 * 
 * @example
 * // DatePicker básico
 * const [birthDate, setBirthDate] = useState(new Date());
 * <DatePicker
 *   label="Fecha de nacimiento"
 *   value={birthDate}
 *   onChange={setBirthDate}
 * />
 * 
 * @example
 * // Con rango de fechas
 * <DatePicker
 *   label="Fecha del evento"
 *   value={eventDate}
 *   onChange={setEventDate}
 *   minDate={new Date()}
 *   maxDate={new Date(2025, 11, 31)}
 * />
 * 
 * @example
 * // Con validación
 * <DatePicker
 *   label="Fecha de inicio"
 *   value={startDate}
 *   onChange={setStartDate}
 *   required
 *   error={!startDate}
 *   errorMessage="La fecha de inicio es requerida"
 * />
 */
export function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Seleccionar fecha",
  minimumDate,
  maximumDate,
  mode = "date",
  error = false,
  errorMessage,
  disabled = false,
  required = false,
  style,
  buttonStyle,
}) {
  const { theme } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const formatDate = (date) => {
    if (!date) return "";
    
    if (mode === "datetime") {
      return formatDateTimeWithConfig(date);
    }
    
    if (mode === "time") {
      return formatTimeWithConfig(date);
    }
    
    return formatDateWithConfig(date);
  };

  const displayText = value ? formatDate(value) : placeholder;

  const handlePress = () => {
    if (disabled) return;
    setIsFocused(true);
    setShowPicker(true);
  };

  const handleChange = (event, selectedDate) => {
    // En Android, el picker se cierra automáticamente
    if (Platform.OS === "android") {
      setShowPicker(false);
      setIsFocused(false);
    }

    if (event.type === "set" && selectedDate) {
      onChange(selectedDate);
      
      // En iOS, cerramos manualmente después de seleccionar
      if (Platform.OS === "ios") {
        setShowPicker(false);
        setIsFocused(false);
      }
    } else if (event.type === "dismissed") {
      setShowPicker(false);
      setIsFocused(false);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: error ? theme.colors.status.error : theme.colors.text.secondary },
          ]}
        >
          {label}
          {required && <Text style={{ color: theme.colors.status.error }}> *</Text>}
        </Text>
      )}

      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        style={[
          styles.pickerButton,
          {
            borderColor: error
              ? theme.colors.status.error
              : isFocused
              ? theme.colors.text.primary
              : theme.colors.border.primary + '80', // 50% opacidad en reposo
            borderWidth: 2, // SIEMPRE 2px para evitar "baile"
            backgroundColor: disabled
              ? theme.colors.background.hover
              : theme.colors.background.surface,
          },
          buttonStyle, // Permite sobrescribir height desde fuera
        ]}
        accessibilityRole="button"
        accessibilityLabel={label || "Seleccionar fecha"}
        accessibilityHint="Abre el selector de fecha"
      >
        <Feather
          name="calendar"
          size={18}
          color={theme.colors.text.secondary}
          style={styles.icon}
        />
        <Text
          style={[
            styles.text,
            {
              color: value
                ? theme.colors.text.primary
                : theme.colors.text.disabled,
            },
          ]}
        >
          {displayText}
        </Text>
        <Feather
          name="chevron-down"
          size={18}
          color={theme.colors.text.secondary}
        />
      </TouchableOpacity>

      {error && errorMessage && (
        <Text style={[styles.message, { color: theme.colors.status.error }]}>
          {errorMessage}
        </Text>
      )}

      {/* Native DateTimePicker */}
      {showPicker && (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          textColor={theme.colors.text.primary}
          accentColor={theme.colors.brand.primary}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: DESIGN_TOKENS.borderRadius.lg,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    minHeight: 48,
    outlineWidth: 0,
    outlineStyle: 'none',
  },
  icon: {
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: 14,
  },
  message: {
    fontSize: 12,
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
});

export default DatePicker;
