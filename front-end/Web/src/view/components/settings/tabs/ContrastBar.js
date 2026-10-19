import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

export function ContrastBar({ ratio }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const pct = Math.min((ratio / 21) * 100, 100);
    const color = ratio >= 7 ? "#10B981" : ratio >= 4.5 ? "#3B82F6" : ratio >= 3 ? "#F59E0B" : "#EF4444";

    return (
        <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12, color: c.text.secondary }}>
                    {t("Ratio de contraste")}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: color }}>
                    {ratio}:1
                </Text>
            </View>
            <View style={{ height: 5, backgroundColor: c.border.primary, borderRadius: 99 }}>
                <View style={{
                    height: "100%",
                    width: `${pct}%`,
                    backgroundColor: color,
                    borderRadius: 99
                }} />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
                {[{ label: "AA (4.5)", min: 4.5 }, { label: "AAA (7)", min: 7 }].map(item => (
                    <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Feather
                            name={ratio >= item.min ? "check-circle" : "x-circle"}
                            size={11}
                            color={ratio >= item.min ? "#10B981" : c.text.disabled}
                        />
                        <Text style={{
                            fontSize: 12,
                            color: ratio >= item.min ? "#10B981" : c.text.disabled
                        }}>
                            {item.label}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}
