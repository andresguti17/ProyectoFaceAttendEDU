import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

export function SecurityMeter({ twoFactor, sessionTime }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    const score = [
        twoFactor,
        parseInt(sessionTime) <= 60,
        parseInt(sessionTime) > 0,
        true, // base
    ].filter(Boolean).length;

    const levels = [t("Débil"), t("Regular"), t("Buena"), t("Fuerte")];
    const colors = ["#EF4444", "#F59E0B", "#3B82F6", "#10B981"];
    const label = levels[score - 1] ?? t("Débil");
    const color = colors[score - 1] ?? "#EF4444";

    return (
        <View style={{
            backgroundColor: c.background.app,
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: c.border.primary,
            gap: 10,
        }}>
            <View style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center"
            }}>
                <Text style={{ fontSize: 12, color: c.text.secondary }}>
                    {t("Nivel de seguridad")}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: color }}>
                    {label}
                </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 4 }}>
                {[1, 2, 3, 4].map(i => (
                    <View key={i} style={{
                        flex: 1,
                        height: 5,
                        borderRadius: 14,
                        backgroundColor: i <= score ? color : c.border.primary,
                    }} />
                ))}
            </View>
            <View style={{ gap: 6 }}>
                {[
                    { label: t("Autenticación de dos factores"), ok: twoFactor },
                    { label: t("Sesión corta (≤60 min)"), ok: parseInt(sessionTime) <= 60 },
                ].map(item => (
                    <View key={item.label} style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6
                    }}>
                        <Feather
                            name={item.ok ? "check-circle" : "circle"}
                            size={13}
                            color={item.ok ? "#10B981" : c.text.disabled}
                        />
                        <Text style={{
                            fontSize: 12,
                            color: item.ok ? c.text.primary : c.text.disabled
                        }}>
                            {item.label}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}
