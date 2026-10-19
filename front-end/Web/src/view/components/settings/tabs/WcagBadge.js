import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

export function WcagBadge({ level }) {
    const { t } = useTranslation();
    const colors = {
        "AAA":   { bg: "#D1FAE5", text: "#065F46" },
        "AA":    { bg: "#DBEAFE", text: "#1E40AF" },
        "A":     { bg: "#FEF3C7", text: "#92400E" },
        "Falla": { bg: "#FEE2E2", text: "#991B1B" },
    };
    const style = colors[level] ?? colors["Falla"];
    return (
        <View style={{
            backgroundColor: style.bg,
            borderRadius: 14,
            paddingHorizontal: 6,
            paddingVertical: 2,
        }}>
            <Text style={{
                fontSize: 10,
                fontWeight: "700",
                color: style.text,
                letterSpacing: 0.5
            }}>
                WCAG {level === "Falla" ? t("Falla") : level}
            </Text>
        </View>
    );
}
