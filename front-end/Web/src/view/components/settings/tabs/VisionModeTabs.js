import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { VISION_MODES, VISION_DESCRIPTIONS } from "../../../../core/theme/presets";

export function VisionModeTabs({ visionMode, onVisionModeChange }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    return (
        <>
            {/* ── Tabs de visión ── */}
            <View style={{
                backgroundColor: c.background.app,
                borderRadius: 14,
                padding: 8,
                borderWidth: 1,
                borderColor: c.border.primary,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
            }}>
                {VISION_MODES.map(vm => {
                    const active = visionMode === vm;
                    return (
                        <TouchableOpacity
                            key={vm}
                            onPress={() => onVisionModeChange(vm)}
                            style={{
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 14,
                                backgroundColor: active ? c.brand.primary : "transparent",
                            }}
                        >
                            <Text style={{
                                fontSize: 10,
                                fontWeight: active ? "600" : "400",
                                color: active ? c.brand.textOnPrimary : c.text.secondary,
                            }}>
                                {vm === "base" ? t("Base") :
                                    vm === "deuteranopia" ? t("Deuteranopia") :
                                        vm === "protanopia" ? t("Protanopia") :
                                            vm === "tritanopia" ? t("Tritanopia") : t("Acromatopsia")}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Descripción */}
            <View>
                <Text style={{
                    fontSize: 11,
                    color: c.text.secondary,
                    lineHeight: 16
                }}>
                    {VISION_DESCRIPTIONS[visionMode]}
                </Text>
            </View>
        </>
    );
}
