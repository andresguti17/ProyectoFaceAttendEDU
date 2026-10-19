import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { buildPaletteForVision } from "../../../../core/theme/presets";

/**
 * ColorPresetSelector
 * 
 * Props:
 * - visionMode: string - Modo de visión actual
 * - customColors: { [semantic]: hex } - Colores actuales (customizados o default)
 * - selectedSemantic: string | null - Slot semántico seleccionado actualmente
 * - onPresetSelect: (preset) => void - Callback al seleccionar un preset
 */
export function ColorPresetSelector({ visionMode, customColors, selectedSemantic, onPresetSelect }) {
    const { theme } = useTheme();
    const c = theme.colors;

    // Construir paleta dinámica para el modo de visión actual
    const palette = buildPaletteForVision(visionMode);

    return (
        <View style={{ gap: 6 }}>
            {/* Barra de colores */}
            <View style={{
                flexDirection: "row",
                height: 34,
                borderRadius: 14,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: c.border.primary,
            }}>
                {palette.map((preset, index) => {
                    // El color mostrado es el customizado actual, no el preset por defecto
                    const displayColor = customColors[preset.semantic];
                    const active = selectedSemantic === preset.semantic;
                    const isLast = index === palette.length - 1;

                    return (
                        <TouchableOpacity
                            key={preset.semantic}
                            onPress={() => onPresetSelect(preset)}
                            style={{
                                flex: 1,
                                backgroundColor: displayColor,
                                alignItems: "center",
                                justifyContent: "center",
                                borderRightWidth: isLast ? 0 : 1,
                                borderRightColor: "rgba(255, 255, 255, 0.2)",
                            }}
                        >
                            {active && (
                                <View style={{
                                    backgroundColor: "rgba(255, 255, 255, 0.3)",
                                    borderRadius: 20,
                                    width: 25,
                                    height: 25,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                    <Feather name="check" size={16} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Nombres abajo de cada color */}
            <View style={{
                flexDirection: "row",
            }}>
                {palette.map(preset => {
                    const active = selectedSemantic === preset.semantic;
                    return (
                        <View
                            key={preset.semantic}
                            style={{
                                flex: 1,
                                alignItems: "center",
                            }}
                        >
                            <Text style={{
                                fontSize: 12,
                                fontWeight: active ? "600" : "400",
                                color: active ? c.brand.primary : c.text.secondary,
                            }}>
                                {preset.label}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}
