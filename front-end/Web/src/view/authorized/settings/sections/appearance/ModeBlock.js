// ============================================================
//  ModeBlock — Selector de modo claro/oscuro/sistema
//  UI pura. Sin estado propio, sin rol.
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { ModeSelector } from "../../../../components/settings/tabs";
import { useSettingsSectionStyles } from "../../modals/useSettingsSectionStyles";

export function ModeBlock() {
    const { t } = useTranslation();
    const { labelStyle, descStyle } = useSettingsSectionStyles();

    return (
        <View style={{ gap: 8 }}>
            <Text style={labelStyle}>{t("Modo de visualización")}</Text>
            <Text style={descStyle}>
                {t("Elige el tema base de la interfaz. Afecta fondos, textos y superficies de todo el programa.")}
            </Text>
            <ModeSelector />
        </View>
    );
}
