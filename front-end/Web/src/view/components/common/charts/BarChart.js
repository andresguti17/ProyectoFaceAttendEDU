import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Gráfica de barras reutilizable
 * 
 * @param {Array} data - Datos: [{ label, values: [{ value, color }] }]
 *   Ejemplo: [{ label: "Lun", values: [{ value: 20, color: "#10B981" }, { value: 5, color: "#F59E0B" }] }]
 * @param {number} height - Altura de la gráfica
 * @param {boolean} showGrid - Mostrar líneas de grid
 * @param {boolean} showLabels - Mostrar etiquetas
 * @param {number} barWidth - Ancho de cada barra
 * @param {number} gap - Espacio entre grupos de barras
 * @param {Function} onBarPress - Callback al presionar una barra (recibe el item completo)
 * @param {string} selectedLabel - Label de la barra actualmente seleccionada
 */
export function BarChart({
  data = [],
  height = 100,
  showGrid = false,
  showLabels = true,
  barWidth = 8,
  gap = 4,
  style,
  onBarPress,
  selectedLabel,
}) {
  const { theme } = useTheme();

  if (!data.length) return null;

  // Calcular valor máximo (si todo es 0, usar 1 para evitar división por 0)
  const maxValue = Math.max(
    1,
    ...data.flatMap(item => 
      Array.isArray(item.values) 
        ? item.values.map(v => v.value)
        : [item.value || 0]
    )
  );

  const renderBars = (item, itemIndex) => {
    const values = Array.isArray(item.values) ? item.values : [{ value: item.value, color: item.color }];
    const isSelected = selectedLabel === item.label;
    const isInteractive = !!onBarPress;
    
    const BarContainer = isInteractive ? TouchableOpacity : View;
    
    return (
      <BarContainer 
        key={item.label} 
        style={[
          styles.barGroup,
          isInteractive && styles.interactiveBarGroup,
          isSelected && {
            backgroundColor: theme.colors.brand.primary + "10",
            borderRadius: DESIGN_TOKENS.borderRadius.md,
            paddingVertical: 6,
            paddingHorizontal: 4,
            transform: [{ scale: 1.05 }],
          }
        ]}
        onPress={isInteractive ? () => onBarPress(item, itemIndex) : undefined}
        activeOpacity={0.7}
      >
        <View style={[styles.barsContainer, { height }]}>
          {values.map((bar, index) => {
            // Calcular altura: si el valor es 0, mostrar barra mínima de 3px
            // si no, calcular proporcionalmente
            const barHeight = bar.value === 0 
              ? 3 
              : Math.max(3, (bar.value / maxValue) * height);
            
            return (
              <View
                key={index}
                style={[
                  styles.bar,
                  {
                    width: barWidth,
                    height: barHeight,
                    backgroundColor: bar.color || theme.colors.brand.primary,
                    opacity: isSelected ? 1 : 0.9,
                    transform: isSelected ? [{ scale: 1.1 }] : [],
                  },
                ]}
              />
            );
          })}
        </View>
        {showLabels && (
          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: isSelected 
              ? theme.colors.brand.primary + "15" 
              : "transparent",
          }}>
            <Text style={[
              styles.label, 
              { 
                color: isSelected 
                  ? theme.colors.brand.primary
                  : theme.colors.text.secondary,
                fontWeight: isSelected ? "700" : "500",
                fontSize: isSelected ? 12 : 11,
              }
            ]}>
              {item.label}
            </Text>
          </View>
        )}
      </BarContainer>
    );
  };

  return (
    <View style={[styles.container, { height: height + (showLabels ? 40 : 0) }, style]}>
      <View style={[styles.chart, { gap }]}>
        {data.map(renderBars)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: "100%",
  },
  barGroup: {
    flex: 1,
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.xs,
    transition: "all 0.2s ease",
  },
  interactiveBarGroup: {
    cursor: "pointer",
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  bar: {
    borderRadius: DESIGN_TOKENS.borderRadius.lg,
    transition: "all 0.2s ease",
  },
  label: {
    fontSize: 11,
    textAlign: "center",
    transition: "all 0.2s ease",
  },
});

export default BarChart;
