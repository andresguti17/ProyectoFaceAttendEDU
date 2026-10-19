// ============================================================
//  FaceAttend EDU — Auth Components (View Layer)
//  Componentes puros de UI para las pantallas de autenticación.
//  Sin lógica de negocio — toda lógica vive en useAuthViewModel.
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme }       from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";

// ── AuthFooterLink ───────────────────────────────────────────

export function AuthFooterLink({ prompt, linkLabel, onPress }) {
    const { theme } = useTheme();
    const c = theme.colors;
    return (
        <View style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
            alignItems: "center",
        }}>
            <Text style={{ fontSize: 14, color: c.text.secondary }}>
                {prompt}
            </Text>
            <TouchableOpacity onPress={onPress}>
                <Text style={{
                    fontSize: 14,
                    color: c.brand.primary,
                    fontWeight: "600"
                }}>
                    {linkLabel}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

// ── BrandPanelCircles ────────────────────────────────────────

export function BrandPanelCircles() {
    return (
        <React.Fragment>
            <View style={{
                position: "absolute",
                width: 180,
                height: 180,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                top: -90,
                left: -90,
            }} />
            <View style={{
                position: "absolute",
                width: 260,
                height: 260,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.06)",
                bottom: -130,
                right: -130,
            }} />
        </React.Fragment>
    );
}

// ── AuthCopyright ─────────────────────────────────────────────

export function AuthCopyright() {
    const { theme } = useTheme();
    const { t }     = useTranslation();
    const c = theme.colors;
    return (
        <Text style={{
            fontSize: 12,
            color: c.text.tertiary,
            textAlign: "center",
        }}>
            {`© FaceAttend EDU ${new Date().getFullYear()} — ${t("Derechos reservados")}`}
        </Text>
    );
}
