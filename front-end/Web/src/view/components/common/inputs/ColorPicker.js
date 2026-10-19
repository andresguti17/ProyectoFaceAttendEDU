import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * ColorPicker component con swatches predefinidos
 * 
 * Selector de colores simple basado en swatches (muestras de color).
 * Ideal para personalización de temas, categorías con colores, etc.
 * 
 * @param {string} value - Color seleccionado (hex format: #RRGGBB)
 * @param {function} onChange - Callback al cambiar color
 * @param {string} label - Etiqueta
 * @param {Array} colors - Array de colores disponibles (hex strings)
 * @param {boolean} error - Si hay error
 * @param {string} errorMessage - Mensaje de error
 * @param {boolean} disabled - Si está deshabilitado
 * @param {number} swatchSize - Tamaño de cada swatch (default: 40)
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * // ColorPicker básico
 * const [color, setColor] = useState("#3B82F6");
 * <ColorPicker
 *   label="Color de categoría"
 *   value={color}
 *   onChange={setColor}
 * />
 * 
 * @example
 * // Con colores personalizados
 * <ColorPicker
 *   label="Color del tema"
 *   value={themeColor}
 *   onChange={setThemeColor}
 *   colors={[
 *     "#FF6B6B", "#4ECDC4", "#45B7D1",
 *     "#FFA07A", "#98D8C8", "#F7DC6F"
 *   ]}
 * />
 * 
 * @example
 * // En formulario de configuración
 * <View>
 *   <TextInput
 *     label="Nombre de categoría"
 *     value={categoryName}
 *     onChangeText={setCategoryName}
 *   />
 *   <ColorPicker
 *     label="Color"
 *     value={categoryColor}
 *     onChange={setCategoryColor}
 *   />
 * </View>
 */
export function ColorPicker({
  value,
  onChange,
  label,
  colors = [
    "#EF4444", // Red
    "#F59E0B", // Orange
    "#EAB308", // Yellow
    "#22C55E", // Green
    "#10B981", // Emerald
    "#14B8A6", // Teal
    "#06B6D4", // Cyan
    "#3B82F6", // Blue
    "#6366F1", // Indigo
    "#8B5CF6", // Purple
    "#A855F7", // Violet
    "#EC4899", // Pink
    "#6B7280", // Gray
    "#1F2937", // Dark Gray
  ],
  error = false,
  errorMessage,
  disabled = false,
  swatchSize = 40,
  style,
}) {
  const { theme } = useTheme();

  const handleSelect = (color) => {
    if (disabled) return;
    onChange(color);
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
        </Text>
      )}

      {/* Selected color preview */}
      {value && (
        <View style={styles.selectedContainer}>
          <View
            style={[
              styles.selectedSwatch,
              {
                backgroundColor: value,
                borderColor: theme.colors.border.primary,
              },
            ]}
          >
            {!disabled && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => onChange(null)}
              >
                <Feather name="x" size={12} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          <Text
            style={[
              styles.selectedText,
              { color: theme.colors.text.primary },
            ]}
          >
            {value.toUpperCase()}
          </Text>
        </View>
      )}

      {/* Color swatches grid */}
      <View style={styles.grid}>
        {colors.map((color) => {
          const isSelected = value === color;
          
          return (
            <TouchableOpacity
              key={color}
              onPress={() => handleSelect(color)}
              disabled={disabled}
              style={[
                styles.swatch,
                {
                  width: swatchSize,
                  height: swatchSize,
                  backgroundColor: color,
                  borderColor: isSelected
                    ? theme.colors.text.primary
                    : theme.colors.border.primary,
                  borderWidth: isSelected ? 3 : 1,
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            >
              {isSelected && (
                <Feather name="check" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {error && errorMessage && (
        <Text style={[styles.message, { color: theme.colors.status.error }]}>
          {errorMessage}
        </Text>
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
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  selectedContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  selectedSwatch: {
    width: 60,
    height: 60,
    borderRadius: DESIGN_TOKENS.borderRadius.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: DESIGN_TOKENS.spacing.md,
  },
  clearButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: DESIGN_TOKENS.spacing.sm,
  },
  swatch: {
    borderRadius: DESIGN_TOKENS.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    fontSize: 12,
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
});

export default ColorPicker;
