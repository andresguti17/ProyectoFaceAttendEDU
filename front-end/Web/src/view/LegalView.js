// ============================================================
//  FaceAttend EDU — Legal VIEW
//
//  Páginas públicas separadas: la Política de privacidad (aviso de la Ley 1581) y los
//  Términos y condiciones son documentos distintos y se consultan sin iniciar sesión.
//  La política de privacidad solo existe en la web; la app móvil muestra únicamente sus términos.
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useResponsive } from "./components/hooks/useResponsive";
import { useTheme } from "./components/hooks/useTheme";
import PrivacyNotice from "./components/privacy/PrivacyNotice";
import TermsDocument from "./components/privacy/TermsDocument";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";

export const LEGAL_DOCS = { privacy: "privacy", terms: "terms" };

export default function LegalView({ doc, onBack }) {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const isPrivacy = doc === LEGAL_DOCS.privacy;

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: c.background.app }}
            contentContainerStyle={{ flexGrow: 1, alignItems: "center", padding: 24 }}
        >
            <View
                style={{
                    width: "100%",
                    maxWidth: 760,
                    backgroundColor: c.background.surface,
                    borderRadius: 16,
                    padding: isSmall ? 20 : 32,
                    gap: 14,
                    borderWidth: 1,
                    borderColor: c.border.primary,
                }}
            >
                <TouchableOpacity onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="arrow-left" size={16} color={c.text.secondary} />
                    <Text style={{ fontSize: 13, color: c.text.secondary }}>{t("Volver")}</Text>
                </TouchableOpacity>
                <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: c.text.primary }}>
                    {isPrivacy ? t("Política de privacidad") : t("Términos y Condiciones")}
                </Text>
                {isPrivacy ? <PrivacyNotice /> : <TermsDocument />}
            </View>
        </ScrollView>
    );
}
