import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

/**
 * ModeSelector
 * 
 * Selector de modo claro/oscuro con preview visual.
 * 
 * Props:
 * - mode: string - Modo actual ("light" | "dark")
 * - onModeChange: (mode: string) => void - Callback cuando cambia el modo
 * 
 * Si no se pasan props, usa el ThemeContext directamente (comportamiento legacy)
 */
export function ModeSelector({ mode: modeProp, onModeChange: onModeChangeProp }) {
    const { mode: contextMode, setMode: setContextMode, theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    // Usar props si están disponibles, sino usar context (compatibilidad)
    const mode = modeProp !== undefined ? modeProp : contextMode;
    const handleModeChange = onModeChangeProp || setContextMode;

    const modes = [
        {
            key: "light",
            label: t("Claro"),
            icon: "sun",
            preview: { bg: "#FFFFFF", surface: "#F9FAFB", text: "#111827" }
        },
        {
            key: "dark",
            label: t("Oscuro"),
            icon: "moon",
            preview: { bg: "#111827", surface: "#1F2937", text: "#F9FAFB" }
        },
    ];

    return (
        <View style={{ flexDirection: "row", gap: 10 }}>
            {modes.map(m => {
                const active = mode === m.key;
                return (
                    <TouchableOpacity
                        key={m.key}
                        onPress={() => handleModeChange(m.key)}
                        style={{
                            flex: 1,
                            borderRadius: 14,
                            borderWidth: active ? 2 : 1.5,
                            borderColor: active ? c.brand.primary : c.border.primary,
                            overflow: "hidden",
                        }}
                        activeOpacity={0.8}
                    >
                        {/* Mini preview del modo */}
                        <View style={{
                            backgroundColor: m.preview.bg,
                            padding: 12,
                            gap: 5
                        }}>
                            <View style={{
                                backgroundColor: m.preview.surface,
                                borderRadius: 14,
                                padding: 8,
                                gap: 3
                            }}>
                                <View style={{
                                    height: 4,
                                    width: "70%",
                                    backgroundColor: m.preview.text,
                                    borderRadius: 14,
                                    opacity: 0.7
                                }} />
                                <View style={{
                                    height: 4,
                                    width: "45%",
                                    backgroundColor: m.preview.text,
                                    borderRadius: 14,
                                    opacity: 0.4
                                }} />
                            </View>
                            <View style={{ flexDirection: "row", gap: 4 }}>
                                <View style={{
                                    flex: 1,
                                    height: 5,
                                    backgroundColor: c.brand.primary,
                                    borderRadius: 14,
                                    opacity: active ? 1 : 0.5
                                }} />
                                <View style={{
                                    flex: 1,
                                    height: 5,
                                    backgroundColor: m.preview.surface,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: c.border.primary
                                }} />
                            </View>
                        </View>
                        {/* Label */}
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            paddingVertical: 10,
                            backgroundColor: active ? c.brand.primaryLight : c.background.surface,
                            borderTopWidth: 1,
                            borderTopColor: c.border.primary,
                        }}>
                            <Feather
                                name={m.icon}
                                size={13}
                                color={active ? c.brand.primary : c.text.secondary}
                            />
                            <Text style={{
                                fontSize: 10,
                                fontWeight: active ? "600" : "400",
                                color: active ? c.brand.primary : c.text.secondary,
                            }}>
                                {m.label}
                            </Text>
                            {active && (
                                <View style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: 14,
                                    backgroundColor: c.brand.primary,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                    <Feather name="check" size={9} color="#fff" />
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
