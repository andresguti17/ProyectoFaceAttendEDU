// ============================================================
//  FaceAttend EDU — PrivacyConsentGate
// ============================================================
//  Pantalla bloqueante que AuthMiddleware muestra mientras la persona no haya
//  aceptado el aviso de privacidad vigente (Ley 1581 de 2012, arts. 9 y 12).
//  La autorización biométrica es una casilla aparte y facultativa (art. 6-a).
// ============================================================

import React, { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../components/hooks/useTheme";
import { useTranslation } from "../../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../../context/AuthContext";
import Button from "../components/common/buttons/Button";
import Alert from "../components/common/feedback/Alert";
import { Checkbox } from "../components/common";
import PrivacyNotice from "../components/privacy/PrivacyNotice";

export default function PrivacyConsentGate() {
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const { acceptPrivacy, logout } = useAuth();
    const [accepted, setAccepted] = useState(false);
    const [biometric, setBiometric] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const submit = async () => {
        if (!accepted || saving) return;
        setSaving(true);
        setError(null);
        const message = await acceptPrivacy({ biometricAccepted: biometric });
        if (message) {
            setError(message);
            setSaving(false);
        }
    };

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: c.background.app }}
            contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 }}
        >
            <View style={{
                width: "100%",
                maxWidth: 560,
                backgroundColor: c.background.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.border.primary,
                padding: 28,
                gap: 16,
            }}>
                <View style={{ alignItems: "center", gap: 8 }}>
                    <Feather name="shield" size={40} color={c.brand.primary} />
                    <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: c.text.primary, textAlign: "center" }}>
                        {t("Aviso de privacidad")}
                    </Text>
                    <Text style={{ fontSize: 14, color: c.text.secondary, textAlign: "center", lineHeight: 20 }}>
                        {t("Antes de continuar, lee cómo tratamos tus datos personales y autoriza su uso.")}
                    </Text>
                </View>

                <PrivacyNotice />

                <Checkbox
                    checked={accepted}
                    onToggle={setAccepted}
                    label={t("Acepto el tratamiento de mis datos personales según este aviso") + " *"}
                />
                <Checkbox
                    checked={biometric}
                    onToggle={setBiometric}
                    label={t("Autorizo el tratamiento de mis datos biométricos (facultativo)")}
                    description={t("Puedes dejarla sin marcar: tu asistencia se registrará por otros medios. Puedes revocarla desde tu perfil.")}
                />

                {error ? <Alert type="error" message={error} /> : null}

                <Button variant="primary" onPress={submit} disabled={!accepted || saving}>
                    {saving ? t("Guardando...") : t("Aceptar y continuar")}
                </Button>
                <Button variant="ghost" onPress={logout}>
                    {t("Cerrar sesión")}
                </Button>
            </View>
        </ScrollView>
    );
}
