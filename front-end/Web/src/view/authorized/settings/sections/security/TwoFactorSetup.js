// ============================================================
//  TwoFactorSetup — Activar o desactivar el código por correo
//
//  Segundo factor de la propia cuenta (no de la sede): al iniciar sesión,
//  después de la contraseña, se pide un código de 6 dígitos que llega al
//  correo de la persona.
//
//  Activar: contraseña → llega un código al correo → se confirma con él
//  (así una dirección equivocada no deja a la persona fuera).
//  Desactivar: contraseña.
// ============================================================
import React, { useState } from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, TextInput, ToggleRow } from "../../../../components/common";
import { SecurityMeter } from "../../../../components/settings/tabs";
import { useAuth } from "../../../../../context/AuthContext";
import { authApi } from "../../../../../services/api/authApi";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { useSettingsSectionStyles } from "../../modals/useSettingsSectionStyles";

/** Mensaje para el usuario según lo que respondió el servidor. */
export function twoFactorErrorMessage(err) {
    const status = err?.status;
    if (status === 401) return "Código incorrecto o vencido";
    if (status === 400) return "Contraseña incorrecta";
    if (status === 423) return "Demasiados intentos. Inténtalo más tarde.";
    if (status === 503) return "No pudimos enviar el código a tu correo. Revisa que tu correo esté registrado e inténtalo de nuevo.";
    return err?.message || "No se pudo completar la operación";
}

export function TwoFactorSetup() {
    const { t } = useTranslation();
    const { c } = useSettingsSectionStyles();
    const { user, updateSessionUser } = useAuth();
    const enabled = user?.twoFactorEnabled === true;

    // null = nada en curso; "password" = pidiendo la contraseña (activar o desactivar);
    // "code" = esperando el código que llegó al correo (solo al activar).
    const [step, setStep] = useState(null);
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [maskedEmail, setMaskedEmail] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    function reset() {
        setStep(null);
        setPassword("");
        setCode("");
        setError("");
    }

    function onToggle() {
        if (step) {
            reset();
            return;
        }
        setError("");
        setStep("password");
    }

    async function submitPassword() {
        if (!password) {
            setError(t("Escribe tu contraseña"));
            return;
        }
        setBusy(true);
        setError("");
        try {
            if (enabled) {
                await authApi.disableTwoFactor(password);
                updateSessionUser({ twoFactorEnabled: false });
                reset();
            } else {
                const res = await authApi.enableTwoFactor(password);
                setMaskedEmail(res?.maskedEmail ?? "");
                setPassword("");
                setStep("code");
            }
        } catch (err) {
            setError(t(twoFactorErrorMessage(err)));
        } finally {
            setBusy(false);
        }
    }

    async function submitCode() {
        if (code.length !== 6) {
            setError(t("Escribe los 6 dígitos del código"));
            return;
        }
        setBusy(true);
        setError("");
        try {
            await authApi.confirmTwoFactor(code);
            updateSessionUser({ twoFactorEnabled: true });
            reset();
        } catch (err) {
            setError(t(twoFactorErrorMessage(err)));
        } finally {
            setBusy(false);
        }
    }

    return (
        <View style={{ gap: 8 }}>
            <ToggleRow
                label={t("Autenticación de dos factores")}
                description={t("Al iniciar sesión, además de la contraseña, te pedimos un código que llega a tu correo. Protege tu cuenta aunque alguien obtenga tu contraseña.")}
                value={enabled || step === "code"}
                onToggle={onToggle}
            />

            {step === "password" && (
                <View style={{ gap: 8 }}>
                    <TextInput
                        label={enabled ? t("Confirma tu contraseña para desactivarlo") : t("Confirma tu contraseña para activarlo")}
                        value={password}
                        onChangeText={(v) => { setPassword(v); setError(""); }}
                        type="password"
                        secureTextEntry
                        error={!!error}
                        errorMessage={error}
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        <Button onPress={submitPassword} loading={busy} disabled={busy}>
                            {enabled ? t("Desactivar") : t("Enviar código")}
                        </Button>
                        <Button variant="secondary" onPress={reset} disabled={busy}>{t("Cancelar")}</Button>
                    </View>
                </View>
            )}

            {step === "code" && (
                <View style={{ gap: 8 }}>
                    <TextInput
                        label={t("Código enviado a {{email}}").replace("{{email}}", maskedEmail || t("tu correo"))}
                        placeholder="000000"
                        value={code}
                        onChangeText={(v) => { setCode(String(v).replace(/\D/g, "").slice(0, 6)); setError(""); }}
                        type="number"
                        maxLength={6}
                        error={!!error}
                        errorMessage={error}
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        <Button onPress={submitCode} loading={busy} disabled={busy}>{t("Activar")}</Button>
                        <Button variant="secondary" onPress={reset} disabled={busy}>{t("Cancelar")}</Button>
                    </View>
                </View>
            )}

            {!enabled && step === null && (
                <View style={{
                    backgroundColor: c.status.warningLight,
                    borderRadius: 14,
                    padding: 12,
                    flexDirection: "row",
                    gap: 8,
                }}>
                    <Feather name="shield" size={13} color={c.status.warning} style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 12, color: c.status.warningDark, flex: 1, lineHeight: 18 }}>
                        {t("Sin 2FA, la cuenta queda vulnerable si la contraseña se compromete. Se recomienda activarlo.")}
                    </Text>
                </View>
            )}
        </View>
    );
}

/** El medidor de seguridad con el estado real del segundo factor de esta cuenta. */
export function OwnSecurityMeter({ sessionTime }) {
    const { user } = useAuth();
    return <SecurityMeter twoFactor={user?.twoFactorEnabled === true} sessionTime={sessionTime} />;
}
