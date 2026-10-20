// ============================================================
//  FaceAttend EDU — ForcePasswordChange
// ============================================================
//  Pantalla bloqueante que AuthMiddleware muestra mientras la cuenta
//  siga con la contraseña inicial (user.mustChangePassword). Al cambiarla,
//  AuthContext apaga el flag y la pantalla original se renderiza sola.
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../components/hooks/useTheme";
import { useTranslation } from "../../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../../context/AuthContext";
import { useChangePasswordViewModel } from "../../viewmodels/useChangePasswordViewModel";
import Button from "../components/common/buttons/Button";
import TextInput from "../components/common/inputs/TextInput";
import Alert from "../components/common/feedback/Alert";
import { PasswordStrengthIndicator } from "../components/auth";

export default function ForcePasswordChange() {
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const { logout } = useAuth();
    const vm = useChangePasswordViewModel();

    const eye = (
        <TouchableOpacity onPress={vm.togglePasswords}>
            <Feather name={vm.showPasswords ? "eye-off" : "eye"} size={20} color={c.text.secondary} />
        </TouchableOpacity>
    );
    const lock = <Feather name="lock" size={20} color={c.text.secondary} />;

    const onKeyPress = (e) => {
        if (e.nativeEvent.key === "Enter" && !vm.loading) vm.submit();
    };

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: c.background.app }}
            contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 }}
        >
            <View style={{
                width: "100%",
                maxWidth: 440,
                backgroundColor: c.background.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.border.primary,
                padding: 28,
                gap: 14,
            }}>
                <View style={{ alignItems: "center", gap: 8 }}>
                    <Feather name="shield" size={40} color={c.status.warning} />
                    <Text style={{ fontSize: 22, fontWeight: "800", color: c.text.primary, textAlign: "center" }}>
                        {t("Cambia tu contraseña")}
                    </Text>
                    <Text style={{ fontSize: 14, color: c.text.secondary, textAlign: "center", lineHeight: 20 }}>
                        {t("Tu cuenta usa la contraseña inicial que te enviamos por correo. Por seguridad, elige una nueva antes de continuar.")}
                    </Text>
                </View>

                <TextInput
                    label={t("Contraseña actual")}
                    placeholder={t("La que recibiste por correo")}
                    value={vm.currentPassword}
                    onChangeText={vm.setCurrent}
                    onKeyPress={onKeyPress}
                    type="password"
                    secureTextEntry={!vm.showPasswords}
                    leftIcon={lock}
                    rightIcon={eye}
                    error={!!vm.errors.currentPassword}
                    errorMessage={vm.errors.currentPassword}
                />

                <View>
                    <TextInput
                        label={t("Nueva contraseña")}
                        placeholder={t("Crea una contraseña")}
                        value={vm.newPassword}
                        onChangeText={vm.setNew}
                        onKeyPress={onKeyPress}
                        type="password"
                        secureTextEntry={!vm.showPasswords}
                        leftIcon={lock}
                        error={!!vm.errors.newPassword}
                        errorMessage={vm.errors.newPassword}
                    />
                    <PasswordStrengthIndicator password={vm.newPassword} show={vm.newPassword.length > 0} />
                </View>

                <TextInput
                    label={t("Confirmar nueva contraseña")}
                    placeholder={t("Repite la contraseña")}
                    value={vm.confirmPassword}
                    onChangeText={vm.setConfirm}
                    onKeyPress={onKeyPress}
                    type="password"
                    secureTextEntry={!vm.showPasswords}
                    leftIcon={lock}
                    error={!!vm.errors.confirmPassword}
                    errorMessage={vm.errors.confirmPassword}
                />

                {!!vm.submitError && <Alert type="error" message={vm.submitError} />}

                <Button onPress={vm.submit} disabled={vm.loading} loading={vm.loading}>
                    {vm.loading ? t("Guardando…") : t("Cambiar contraseña")}
                </Button>

                <TouchableOpacity onPress={logout} style={{ alignItems: "center", paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13, color: c.text.secondary }}>{t("Cerrar sesión")}</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
