import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

export function ConfidenceGuide({ value }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    const zones = [
        {
            min: 60,
            max: 74,
            label: t("Permisivo"),
            color: "#10B981",
            desc: t("Detecta bien aunque haya cambios de luz o ángulo. Más falsos positivos.")
        },
        {
            min: 75,
            max: 89,
            label: t("Equilibrado"),
            color: "#3B82F6",
            desc: t("Buen balance entre precisión y tolerancia. Recomendado para la mayoría.")
        },
        {
            min: 90,
            max: 94,
            label: t("Estricto"),
            color: "#F59E0B",
            desc: t("Muy preciso, pero puede fallar si el estudiante cambió de lentes o peinado.")
        },
        {
            min: 95,
            max: 99,
            label: t("Muy estricto"),
            color: "#EF4444",
            desc: t("Alto riesgo de falsos negativos. Solo para entornos con iluminación controlada.")
        },
    ];

    const zone = zones.find(z => value >= z.min && value <= z.max) ?? zones[1];

    return (
        <View style={{
            backgroundColor: zone.color + "12",
            borderRadius: 14,
            padding: 12,
            borderLeftWidth: 3,
            borderLeftColor: zone.color,
            gap: 6,
        }}>
            <Text style={{
                fontSize: 12,
                fontWeight: "700",
                color: zone.color
            }}>
                {zone.label}
            </Text>
            <Text style={{
                fontSize: 12,
                color: c.text.primary,
                lineHeight: 20
            }}>
                {zone.desc}
            </Text>
        </View>
    );
}
