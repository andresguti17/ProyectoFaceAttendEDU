// ============================================================
//  TwoFactorRow — Toggle de autenticación de dos factores
//  UI pura. Sin rol hardcodeado — el texto llega por props.
//
//  Props:
//   - value       : boolean
//   - onToggle    : () => void
//   - description : string — texto descriptivo (lo define el rol)
//   - warningText : string — texto de alerta cuando está inactivo
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ToggleRow } from "../../../../components/common";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { useSettingsSectionStyles } from "../../modals/useSettingsSectionStyles";

export function TwoFactorRow({ value, onToggle, description, warningText }) {
    const { t } = useTranslation();
    const { c } = useSettingsSectionStyles();

    return (
        <View style={{ gap: 0 }}>
            <ToggleRow
                label={t("Autenticación de dos factores")}
                description={description}
                value={value}
                onToggle={onToggle}
            />

            {!value && (
                <View style={{
                    marginTop: 8,
                    backgroundColor: c.status.warningLight,
                    borderRadius: 14,
                    padding: 12,
                    flexDirection: "row",
                    gap: 8,
                }}>
                    <Feather name="shield" size={13} color={c.status.warning} style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 12, color: c.status.warningDark, flex: 1, lineHeight: 18 }}>
                        {warningText}
                    </Text>
                </View>
            )}
        </View>
    );
}
