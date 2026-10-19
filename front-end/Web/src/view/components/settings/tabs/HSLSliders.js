import React from "react";
import { View, Text } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

export function HSLSliders({ hue, sat, lum, currentHex, onHueChange, onSatChange, onLumChange }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    // Etiquetas descriptivas para cada slider
    const sliderDescriptions = {
        hue: {
            ranges: [
                { max: 30, label: t("🔴 Rojo") },
                { max: 60, label: t("🟠 Naranja") },
                { max: 150, label: t("🟢 Verde") },
                { max: 200, label: t("🩵 Cian") },
                { max: 270, label: t("🔵 Azul") },
                { max: 300, label: t("🟣 Violeta") },
                { max: 330, label: t("🩷 Rosa") },
                { max: 360, label: t("🔴 Rojo") },
            ],
            get: (v) => sliderDescriptions.hue.ranges.find(r => v < r.max)?.label ?? t("Rojo")
        },
        sat: (v) =>
            v < 15 ? t("Gris / neutro") :
            v < 40 ? t("Suave") :
            v < 70 ? t("Equilibrado") :
            v < 90 ? t("Vivo") : t("Muy intenso"),
        lum: (v) =>
            v < 20 ? t("Casi negro") :
            v < 35 ? t("Oscuro") :
            v < 55 ? t("Medio — ideal ✓") :
            v < 70 ? t("Claro") : t("Muy claro"),
    };

    const sliders = [
        {
            label: t("Tono"),
            val: hue,
            min: 0,
            max: 360,
            onChange: onHueChange,
            suffix: "°",
            desc: sliderDescriptions.hue.get(hue),
            gradient: "hue",
        },
        {
            label: t("Saturación"),
            val: sat,
            min: 0,
            max: 100,
            onChange: onSatChange,
            suffix: "%",
            desc: sliderDescriptions.sat(sat),
            hint: sat < 20
                ? t("⚠ Muy bajo — el color se verá gris")
                : sat > 90
                ? t("⚠ Muy alto — puede fatigar la vista")
                : null,
        },
        {
            label: t("Luminosidad"),
            val: lum,
            min: 0,
            max: 100,
            onChange: onLumChange,
            suffix: "%",
            desc: sliderDescriptions.lum(lum),
            hint: lum > 75
                ? t("⚠ Muy claro — el texto blanco encima no será legible")
                : lum < 22
                ? t("⚠ Muy oscuro — puede confundirse con el texto")
                : null,
        },
    ];

    return (
        <View style={{ gap: 14 }}>
            {sliders.map(sl => (
                <View key={sl.label} style={{ gap: 5 }}>
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between"
                    }}>
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6
                        }}>
                            <Text style={{
                                fontSize: 11,
                                color: c.text.secondary
                            }}>
                                {sl.label}
                            </Text>
                            <Text style={{
                                fontSize: 11,
                                color: c.text.disabled
                            }}>
                                — {sl.desc}
                            </Text>
                        </View>
                        <Text style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: c.text.primary
                        }}>
                            {sl.val}{sl.suffix}
                        </Text>
                    </View>
                    <Slider
                        minimumValue={sl.min}
                        maximumValue={sl.max}
                        step={1}
                        value={sl.val}
                        onValueChange={sl.onChange}
                        minimumTrackTintColor={currentHex}
                        maximumTrackTintColor={c.border.primary}
                    />
                    {sl.hint && (
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5
                        }}>
                            <Text style={{
                                fontSize: 11,
                                color: "#F59E0B"
                            }}>
                                {sl.hint}
                            </Text>
                        </View>
                    )}
                </View>
            ))}
        </View>
    );
}
