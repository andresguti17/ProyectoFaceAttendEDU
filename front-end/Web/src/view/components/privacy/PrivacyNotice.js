// ============================================================
//  FaceAttend EDU — PrivacyNotice
//  Texto del aviso de privacidad (Ley 1581 de 2012, art. 12) con su versión.
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { PRIVACY_NOTICE, PRIVACY_POLICY_VERSION } from "../../../core/config/privacy";

export default function PrivacyNotice({ compact = false }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const sections = compact ? PRIVACY_NOTICE.filter((s) => s.title.startsWith("Datos biom")) : PRIVACY_NOTICE;

    return (
        <View accessibilityRole="summary" style={{ gap: 10 }}>
            {sections.map((section) => (
                <View key={section.title} style={{ gap: 2 }}>
                    <Text style={{ fontWeight: "700", fontSize: 13, color: c.text.primary }}>{t(section.title)}</Text>
                    <Text style={{ fontSize: 13, lineHeight: 19, color: c.text.secondary }}>{t(section.body)}</Text>
                </View>
            ))}
            {!compact && (
                <Text style={{ fontSize: 11, color: c.text.tertiary ?? c.text.secondary }}>
                    {t("Versión del aviso")}: {PRIVACY_POLICY_VERSION}
                </Text>
            )}
        </View>
    );
}
