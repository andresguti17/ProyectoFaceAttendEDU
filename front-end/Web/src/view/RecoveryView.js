// ============================================================
//  FaceAttend EDU — Recovery VIEW
//
//  Presentación del flujo forgot-password -> verify-code ->
//  reset-password. La lógica vive en useRecoveryViewModel;
//  la navegación la decide el Screen via callbacks.
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useResponsive } from "./components/hooks/useResponsive";
import { useTheme } from "./components/hooks/useTheme";
import Button from "./components/common/buttons/Button";
import TextInput from "./components/common/inputs/TextInput";
import { useRecoveryViewModel, RECOVERY_STEPS } from "../viewmodels/useRecoveryViewModel";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";

export default function RecoveryView({ onDone, onBack }) {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const vm = useRecoveryViewModel();

    const card = (children, title, subtitle) => (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <View
                style={{
                    width: "100%",
                    maxWidth: 440,
                    backgroundColor: c.background.surface,
                    borderRadius: 16,
                    padding: isSmall ? 20 : 28,
                    gap: 12,
                    borderWidth: 1,
                    borderColor: c.border.primary,
                }}
            >
                <TouchableOpacity
                    onPress={onBack}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                    <Feather name="arrow-left" size={16} color={c.text.secondary} />
                    <Text style={{ fontSize: 13, color: c.text.secondary }}>{t("Volver")}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: "700", color: c.text.primary }}>
                    {title}
                </Text>
                <Text style={{ fontSize: 13, color: c.text.secondary }}>{subtitle}</Text>
                {children}
                {vm.error && (
                    <View
                        style={{
                            backgroundColor: c.status.dangerLight,
                            borderRadius: 12,
                            padding: 10,
                            flexDirection: "row",
                            gap: 8,
                        }}
                    >
                        <Feather name="alert-circle" size={14} color={c.status.danger} />
                        <Text style={{ fontSize: 12, color: c.status.danger, flex: 1 }}>
                            {vm.error}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );

    const submitButton = (label, onPress) => (
        <Button variant="primary" onPress={onPress} disabled={vm.sending}>
            {vm.sending ? (
                <ActivityIndicator size="small" color={c.brand.textOnPrimary} />
            ) : (
                label
            )}
        </Button>
    );

    if (vm.step === RECOVERY_STEPS.CODE) {
        return card(
            <>
                <TextInput
                    label={t("Código de verificación")}
                    placeholder="123456"
                    value={vm.code}
                    onChangeText={vm.setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    leftIcon={<Feather name="key" size={20} color={c.text.secondary} />}
                />
                {submitButton(t("Verificar código"), vm.verifyCode)}
                <Button variant="ghost" onPress={vm.sendCode} disabled={vm.sending}>
                    {t("Reenviar código")}
                </Button>
            </>,
            t("Revisa tu correo"),
            t("Enviamos un código de 6 dígitos a tu correo.")
        );
    }

    if (vm.step === RECOVERY_STEPS.PASSWORD) {
        return card(
            <>
                <TextInput
                    label={t("Nueva contraseña")}
                    placeholder={t("Mínimo 8 caracteres")}
                    value={vm.password}
                    onChangeText={vm.setPassword}
                    type="password"
                    leftIcon={<Feather name="lock" size={20} color={c.text.secondary} />}
                />
                <TextInput
                    label={t("Confirmar contraseña")}
                    placeholder={t("Repite la contraseña")}
                    value={vm.confirm}
                    onChangeText={vm.setConfirm}
                    type="password"
                    leftIcon={<Feather name="lock" size={20} color={c.text.secondary} />}
                />
                {submitButton(t("Guardar contraseña"), vm.resetPassword)}
            </>,
            t("Nueva contraseña"),
            t("Elige una contraseña de al menos 8 caracteres.")
        );
    }

    if (vm.step === RECOVERY_STEPS.DONE) {
        return card(
            <>
                <View style={{ alignItems: "center", paddingVertical: 8 }}>
                    <Feather name="check-circle" size={48} color={c.status.success} />
                </View>
                {submitButton(t("Volver al inicio de sesión"), onDone)}
            </>,
            t("Contraseña actualizada"),
            t("Ya puedes ingresar con tu nueva contraseña.")
        );
    }

    return card(
        <>
            <TextInput
                label={t("Correo electrónico")}
                placeholder={t("correo@universidad.edu")}
                value={vm.email}
                onChangeText={vm.setEmail}
                type="email"
                leftIcon={<Feather name="mail" size={20} color={c.text.secondary} />}
            />
            {submitButton(t("Enviar código"), vm.sendCode)}
        </>,
        t("Recuperar contraseña"),
        t("Ingresa tu correo para recibir un código de verificación.")
    );
}
