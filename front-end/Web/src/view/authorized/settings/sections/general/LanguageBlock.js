// ============================================================
//  LanguageBlock — Selector de idioma de la aplicación
//  UI pura. Sin estado propio.
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { LanguageSelector } from "../../../../components/settings/tabs";
import { useSettingsSectionStyles } from "../../modals/useSettingsSectionStyles";

export function LanguageBlock() {
    const { t } = useTranslation();
    const { labelStyle, descStyle } = useSettingsSectionStyles();

    return (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: 1 }}>
                <Text style={labelStyle}>{t("Idioma de la aplicación")}</Text>
                <Text style={[descStyle, { marginTop: 0 }]}>
                    {t("Traduce toda la interfaz automáticamente. El español es el idioma original de FaceAttend EDU.")}
                </Text>
            </View>
            <LanguageSelector />
        </View>
    );
}
