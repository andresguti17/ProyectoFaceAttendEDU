// ============================================================
//  FaceAttend EDU — Profile VIEW (Presentation Layer)
//
//  RESPONSABILIDAD: Mostrar los datos de la persona en sesión y dejarle
//  editar solo contacto y salud, más el cambio de su contraseña.
//  Nombres, documento, usuario, rol y sede son de solo lectura.
//
//  Toda la lógica está en useProfileViewModel / useChangePasswordViewModel.
// ============================================================

import React, { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, Avatar, Button, Card, PageHeader, TextInput, AnimatedDropdown } from "./components/common";
import { useTheme } from "./components/hooks/useTheme";
import { useResponsive } from "./components/hooks/useResponsive";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useProfileViewModel } from "../viewmodels/useProfileViewModel";
import { useChangePasswordViewModel } from "../viewmodels/useChangePasswordViewModel";
import { BLOOD_TYPES } from "../core/utils/profileForm";
import { PasswordStrengthIndicator } from "./components/auth";

const BLOOD_ITEMS = BLOOD_TYPES.map((b) => ({ value: b, label: b, icon: "droplet" }));

function ReadOnlyRow({ label, value }) {
    const { theme } = useTheme();
    const c = theme.colors;
    if (!value) return null;
    return (
        <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 12, color: c.text.secondary }}>{label}</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: c.text.primary }}>{value}</Text>
        </View>
    );
}

function SectionTitle({ icon, children }) {
    const { theme } = useTheme();
    const c = theme.colors;
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Feather name={icon} size={16} color={c.brand.primary} />
            <Text style={{ fontSize: 16, fontWeight: "800", color: c.text.primary }}>{children}</Text>
        </View>
    );
}

// ── Cambio de contraseña (reutiliza el viewmodel del cambio obligatorio) ──
function ChangePasswordCard() {
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const vm = useChangePasswordViewModel();
    const [done, setDone] = useState(false);

    const submit = async () => {
        setDone(false);
        if (await vm.submit()) {
            vm.reset();
            setDone(true);
        }
    };

    const eye = (
        <TouchableOpacity onPress={vm.togglePasswords}>
            <Feather name={vm.showPasswords ? "eye-off" : "eye"} size={20} color={c.text.secondary} />
        </TouchableOpacity>
    );

    return (
        <View>
            <SectionTitle icon="lock">{t("Contraseña")}</SectionTitle>
            <Card variant="outlined">
                <View style={{ gap: 12 }}>
                    {done && <Alert type="success" message={t("Contraseña actualizada")} />}
                    {!!vm.submitError && <Alert type="error" message={vm.submitError} />}
                    <TextInput
                        label={t("Contraseña actual")}
                        value={vm.currentPassword}
                        onChangeText={vm.setCurrent}
                        type="password"
                        secureTextEntry={!vm.showPasswords}
                        rightIcon={eye}
                        error={!!vm.errors.currentPassword}
                        errorMessage={vm.errors.currentPassword}
                    />
                    <View>
                        <TextInput
                            label={t("Nueva contraseña")}
                            value={vm.newPassword}
                            onChangeText={vm.setNew}
                            type="password"
                            secureTextEntry={!vm.showPasswords}
                            error={!!vm.errors.newPassword}
                            errorMessage={vm.errors.newPassword}
                        />
                        <PasswordStrengthIndicator password={vm.newPassword} show={vm.newPassword.length > 0} />
                    </View>
                    <TextInput
                        label={t("Confirmar nueva contraseña")}
                        value={vm.confirmPassword}
                        onChangeText={vm.setConfirm}
                        type="password"
                        secureTextEntry={!vm.showPasswords}
                        error={!!vm.errors.confirmPassword}
                        errorMessage={vm.errors.confirmPassword}
                    />
                    <View style={{ alignItems: "flex-start" }}>
                        <Button onPress={submit} disabled={vm.loading} loading={vm.loading}>
                            {vm.loading ? t("Guardando…") : t("Cambiar contraseña")}
                        </Button>
                    </View>
                </View>
            </Card>
        </View>
    );
}

export default function ProfileView() {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const vm = useProfileViewModel();

    const doc = [vm.account.documentType, vm.account.documentNumber].filter(Boolean).join(" ");

    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            <PageHeader title={t("Mi perfil")} subtitle={t("Consulta tus datos y actualiza tu información de contacto")} />

            <ScrollView
                contentContainerStyle={{ padding: isSmall ? 16 : 24, gap: 24, maxWidth: 760, width: "100%", alignSelf: "center" }}
                showsVerticalScrollIndicator={false}
            >
                {vm.loading ? (
                    <ActivityIndicator color={c.brand.primary} />
                ) : vm.loadError ? (
                    <Alert type="error" title={t("No se pudo cargar")} message={vm.loadError} />
                ) : (
                    <>
                        {/* ── Cuenta: solo lectura ── */}
                        <View>
                            <SectionTitle icon="user">{t("Datos de la cuenta")}</SectionTitle>
                            <Card variant="outlined">
                                <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
                                    <Avatar name={vm.account.fullName} size={56} />
                                    <View style={{ flex: 1, gap: 10 }}>
                                        <ReadOnlyRow label={t("Nombre")} value={vm.account.fullName} />
                                        <ReadOnlyRow label={t("Documento")} value={doc} />
                                        <ReadOnlyRow label={t("Usuario")} value={vm.account.username} />
                                        <ReadOnlyRow label={t("Rol")} value={t(vm.account.roleLabel)} />
                                        <ReadOnlyRow label={t("Sede")} value={vm.account.schoolName} />
                                    </View>
                                </View>
                                <Text style={{ fontSize: 12, color: c.text.secondary, marginTop: 12 }}>
                                    {t("Estos datos los cambia la administración de tu institución.")}
                                </Text>
                            </Card>
                        </View>

                        {/* ── Datos personales: editables ── */}
                        <View>
                            <SectionTitle icon="edit-3">{t("Datos personales")}</SectionTitle>
                            <Card variant="outlined">
                                <View style={{ gap: 12 }}>
                                    {vm.saved && <Alert type="success" message={t("Perfil actualizado")} />}
                                    {!!vm.submitError && <Alert type="error" message={vm.submitError} />}

                                    <TextInput
                                        label={t("Correo electrónico")}
                                        value={vm.values.email}
                                        onChangeText={(v) => vm.setField("email", v)}
                                        type="email"
                                        helperText={t("Es tu identificador para iniciar sesión")}
                                        error={!!vm.errors.email}
                                        errorMessage={vm.errors.email}
                                    />
                                    {vm.needsPassword && (
                                        <TextInput
                                            label={t("Contraseña actual")}
                                            value={vm.values.currentPassword}
                                            onChangeText={(v) => vm.setField("currentPassword", v)}
                                            type="password"
                                            secureTextEntry
                                            helperText={t("Necesaria para cambiar el correo")}
                                            error={!!vm.errors.currentPassword}
                                            errorMessage={vm.errors.currentPassword}
                                        />
                                    )}
                                    <View style={{ flexDirection: isSmall ? "column" : "row", gap: 12 }}>
                                        <View style={{ flex: 1 }}>
                                            <TextInput
                                                label={t("Teléfono")}
                                                value={vm.values.phone}
                                                onChangeText={(v) => vm.setField("phone", v)}
                                                type="phone"
                                                error={!!vm.errors.phone}
                                                errorMessage={vm.errors.phone}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <TextInput
                                                label={t("Nacimiento (AAAA-MM-DD)")}
                                                value={vm.values.birthDate}
                                                onChangeText={(v) => vm.setField("birthDate", v)}
                                                placeholder={t("Ej: 2005-03-14")}
                                                error={!!vm.errors.birthDate}
                                                errorMessage={vm.errors.birthDate}
                                            />
                                        </View>
                                    </View>
                                    <TextInput
                                        label={t("Dirección")}
                                        value={vm.values.address}
                                        onChangeText={(v) => vm.setField("address", v)}
                                        error={!!vm.errors.address}
                                        errorMessage={vm.errors.address}
                                    />
                                    <View>
                                        <Text style={{ fontSize: 13, color: c.text.secondary, marginBottom: 6 }}>
                                            {t("Tipo de sangre")}
                                        </Text>
                                        <AnimatedDropdown
                                            items={BLOOD_ITEMS}
                                            value={vm.values.bloodType}
                                            onSelect={(v) => vm.setField("bloodType", v)}
                                            placeholder={t("Seleccionar tipo")}
                                            triggerHeight={48}
                                        />
                                    </View>

                                    <View style={{ flexDirection: "row", gap: 10 }}>
                                        <Button onPress={vm.save} disabled={!vm.dirty || vm.saving} loading={vm.saving}>
                                            {vm.saving ? t("Guardando…") : t("Guardar cambios")}
                                        </Button>
                                        <Button variant="outline" onPress={vm.discard} disabled={!vm.dirty || vm.saving}>
                                            {t("Descartar")}
                                        </Button>
                                    </View>
                                </View>
                            </Card>
                        </View>

                        <ChangePasswordCard />
                    </>
                )}
            </ScrollView>
        </View>
    );
}
