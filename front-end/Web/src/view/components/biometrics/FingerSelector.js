// ============================================================
//  FaceAttend EDU — FingerSelector
//
//  Elige qué dedo se registra (finger_number 1..10 de ms-biometric).
//  Numeración ISO/ANSI: 1-5 mano derecha (pulgar → meñique),
//  6-10 mano izquierda (pulgar → meñique).
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { DESIGN_TOKENS } from "../../../core/config/theme.config";

const FINGERS = ["Pulgar", "Índice", "Medio", "Anular", "Meñique"];
const HANDS = [
    { label: "Mano derecha", first: 1 },
    { label: "Mano izquierda", first: 6 },
];

export const fingerName = (number) => {
    const index = (number - 1) % 5;
    return `${FINGERS[index]} ${number <= 5 ? "derecho" : "izquierdo"}`;
};

export default function FingerSelector({ value, onChange, disabled = false }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    return (
        <View style={{ gap: DESIGN_TOKENS.spacing.sm }}>
            <Text style={{ color: c.text.primary, fontSize: 13, fontWeight: "600" }}>
                {t("Dedo a registrar")}: {t(fingerName(value))}
            </Text>
            {HANDS.map((hand) => (
                <View key={hand.first} style={{ gap: 6 }}>
                    <Text style={{ color: c.text.secondary, fontSize: 11 }}>{t(hand.label)}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {FINGERS.map((finger, index) => {
                            const number = hand.first + index;
                            const selected = value === number;
                            return (
                                <TouchableOpacity
                                    key={number}
                                    accessibilityRole="button"
                                    accessibilityLabel={t(`${finger} ${number <= 5 ? "derecho" : "izquierdo"}`)}
                                    accessibilityState={{ selected, disabled }}
                                    disabled={disabled}
                                    onPress={() => onChange(number)}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 7,
                                        borderRadius: DESIGN_TOKENS.borderRadius.md,
                                        borderWidth: 1.5,
                                        borderColor: selected ? c.brand.primary : c.border.primary,
                                        backgroundColor: selected ? c.brand.primaryLight : c.background.app,
                                        opacity: disabled ? 0.5 : 1,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: selected ? "700" : "500",
                                            color: selected ? c.brand.primary : c.text.secondary,
                                        }}
                                    >
                                        {t(finger)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            ))}
        </View>
    );
}
