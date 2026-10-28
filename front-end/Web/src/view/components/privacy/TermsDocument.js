// ============================================================
//  FaceAttend EDU — TermsDocument
//  Texto de los términos y condiciones con su versión. Separado del aviso de
//  privacidad (PrivacyNotice), que es otro documento.
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { TERMS_AND_CONDITIONS, TERMS_VERSION } from "../../../core/config/terms";

export default function TermsDocument() {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    return (
        <View accessibilityRole="summary" style={{ gap: 10 }}>
            {TERMS_AND_CONDITIONS.map((section) => (
                <View key={section.title} style={{ gap: 2 }}>
                    <Text style={{ fontWeight: "700", fontSize: 13, color: c.text.primary }}>{t(section.title)}</Text>
                    <Text style={{ fontSize: 13, lineHeight: 19, color: c.text.secondary }}>{t(section.body)}</Text>
                </View>
            ))}
            <Text style={{ fontSize: 11, color: c.text.tertiary ?? c.text.secondary }}>
                {t("Versión de los términos")}: {TERMS_VERSION}
            </Text>
        </View>
    );
}
