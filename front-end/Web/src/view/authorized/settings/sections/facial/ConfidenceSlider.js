// ============================================================
//  ConfidenceSlider — Slider de umbral de confianza facial
//  UI pura. Sin estado propio.
//
//  Props:
//   - value    : number (60–99)
//   - onChange : (number) => void
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import Slider from "@react-native-community/slider";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { ConfidenceGuide } from "../../../../components/settings/tabs";
import { useSettingsSectionStyles } from "../../modals/useSettingsSectionStyles";

export function ConfidenceSlider({ value, onChange }) {
    const { t } = useTranslation();
    const { c, labelStyle, descStyle } = useSettingsSectionStyles();

    return (
        <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
                <View>
                    <Text style={labelStyle}>{t("Umbral de confianza")}</Text>
                    <Text style={[descStyle, { marginTop: 0 }]}>{t("Qué tan seguro debe estar el modelo para registrar")}</Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: "800", color: c.brand.primary }}>{value}%</Text>
            </View>
            <Slider
                minimumValue={60} maximumValue={99} step={1}
                value={value} onValueChange={onChange}
                minimumTrackTintColor={c.brand.primary}
                maximumTrackTintColor={c.border.primary}
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                {[`60 — ${t("Permisivo")}`, "75", "85 ✓", `95 — ${t("Estricto")}`, "99"].map((v, i) => (
                    <Text key={i} style={{ fontSize: 12, color: c.text.disabled }}>{v}</Text>
                ))}
            </View>
            <View style={{ marginTop: 12 }}>
                <ConfidenceGuide value={value} />
            </View>
        </View>
    );
}
