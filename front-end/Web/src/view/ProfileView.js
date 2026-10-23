// ============================================================
//  FaceAttend EDU — Profile VIEW (Presentation Layer)
//
//  RESPONSABILIDAD: Mostrar los datos de la persona en sesión y dejarle
//  editar solo contacto y salud, más el cambio de su contraseña.
//  Nombres, documento, usuario, rol y sede son de solo lectura.
//
//  Estructura: tarjeta de identidad arriba; abajo, a dos columnas en
//  escritorio, los datos de la cuenta (solo lectura) y el formulario de
//  información personal; al final, la seguridad (contraseña).
//
//  Toda la lógica está en useProfileViewModel / useChangePasswordViewModel.
// ============================================================

import React, { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, Avatar, Badge, Button, Card, PageHeader, TextInput, AnimatedDropdown } from "./components/common";
import { DateInput } from "./components/common/inputs/DateInput";
import { useTheme } from "./components/hooks/useTheme";
import { useResponsive } from "./components/hooks/useResponsive";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useProfileViewModel } from "../viewmodels/useProfileViewModel";
import { useChangePasswordViewModel } from "../viewmodels/useChangePasswordViewModel";
import { BLOOD_TYPES } from "../core/utils/profileForm";
import { PasswordStrengthIndicator } from "./components/auth";

const BLOOD_ITEMS = BLOOD_TYPES.map((b) => ({ value: b, label: b, icon: "droplet" }));

// ── Piezas de presentación ───────────────────────────────────

function CardHeading({ icon, title, subtitle }) {
    const { theme } = useTheme();
    const c = theme.colors;
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: c.background.hover,
                alignItems: "center", justifyContent: "center",
            }}>
                <Feather name={icon} size={18} color={c.brand.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: c.text.primary }}>{title}</Text>
                {!!subtitle && (
                    <Text style={{ fontSize: 12, color: c.text.secondary, marginTop: 2 }}>{subtitle}</Text>
                )}
            </View>
        </View>
    );
}

function InfoRow({ icon, label, value }) {
    const { theme } = useTheme();
    const c = theme.colors;
    if (!value) return null;
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
            <Feather name={icon} size={16} color={c.text.secondary} />
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: c.text.secondary, letterSpacing: 0.3, textTransform: "uppercase" }}>
                    {label}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: "600", color: c.text.primary, marginTop: 1 }}>
                    {value}
                </Text>
            </View>
        </View>
    );
}

function GroupLabel({ children }) {
    const { theme } = useTheme();
    const c = theme.colors;
    return (
        <Text style={{
            fontSize: 12, fontWeight: "700", color: c.text.secondary,
            letterSpacing: 0.5, textTransform: "uppercase", marginTop: 4,
        }}>
            {children}
        </Text>
    );
}

// ── Seguridad: cambio de contraseña (reutiliza el viewmodel del cambio obligatorio) ──

function SecurityCard() {
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const vm = useChangePasswordViewModel();
    const [open, setOpen] = useState(false);
    const [done, setDone] = useState(false);

    const submit = async () => {
        if (await vm.submit()) {
            vm.reset();
            setOpen(false);
            setDone(true);
        }
    };

    const close = () => {
        vm.reset();
        setOpen(false);
    };

    const eye = (
        <TouchableOpacity onPress={vm.togglePasswords}>
            <Feather name={vm.showPasswords ? "eye-off" : "eye"} size={20} color={c.text.secondary} />
        </TouchableOpacity>
    );

    return (
        <Card variant="outlined">
            <CardHeading
                icon="lock"
                title={t("Seguridad")}
                subtitle={t("Protege tu cuenta con una contraseña que solo tú conozcas")}
            />
            {done && !open && (
                <View style={{ marginBottom: 12 }}>
                    <Alert type="success" message={t("Contraseña actualizada")} />
                </View>
            )}
            {!open ? (
                <View style={{ alignItems: "flex-start" }}>
                    <Button variant="outline" onPress={() => { setDone(false); setOpen(true); }}>
                        {t("Cambiar contraseña")}
                    </Button>
                </View>
            ) : (
                <View style={{ gap: 12, maxWidth: 420 }}>
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
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <Button onPress={submit} disabled={vm.loading} loading={vm.loading}>
                            {vm.loading ? t("Guardando…") : t("Actualizar contraseña")}
                        </Button>
                        <Button variant="outline" onPress={close} disabled={vm.loading}>
                            {t("Cancelar")}
                        </Button>
                    </View>
                </View>
            )}
        </Card>
    );
}

// ── Pantalla ─────────────────────────────────────────────────

export default function ProfileView() {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const vm = useProfileViewModel();

    const doc = [vm.account.documentType, vm.account.documentNumber].filter(Boolean).join(" ");
    const stacked = isSmall;

    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            <PageHeader
                title={t("Mi perfil")}
                subtitle={t("Consulta tus datos y actualiza tu información de contacto")}
            />

            <ScrollView
                contentContainerStyle={{ padding: isSmall ? 16 : 24, alignItems: "center" }}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ width: "100%", maxWidth: 980, gap: 20 }}>
                    {vm.loading ? (
                        <ActivityIndicator color={c.brand.primary} style={{ marginTop: 40 }} />
                    ) : vm.loadError ? (
                        <Alert type="error" title={t("No se pudo cargar")} message={vm.loadError} />
                    ) : (
                        <>
                            {/* ── Identidad ── */}
                            <Card variant="elevated">
                                <View style={{
                                    flexDirection: stacked ? "column" : "row",
                                    alignItems: "center",
                                    gap: 20,
                                }}>
                                    <Avatar name={vm.account.fullName} size={84} />
                                    <View style={{ flex: 1, gap: 8, alignItems: stacked ? "center" : "flex-start" }}>
                                        <Text style={{
                                            fontSize: 24, fontWeight: "800", color: c.text.primary,
                                            textAlign: stacked ? "center" : "left",
                                        }}>
                                            {vm.account.fullName}
                                        </Text>
                                        <View style={{
                                            flexDirection: "row", flexWrap: "wrap", gap: 8,
                                            justifyContent: stacked ? "center" : "flex-start",
                                        }}>
                                            {!!vm.account.roleLabel && (
                                                <Badge variant="primary" icon="shield">{t(vm.account.roleLabel)}</Badge>
                                            )}
                                            {!!vm.account.schoolName && (
                                                <Badge variant="default" icon="home">{vm.account.schoolName}</Badge>
                                            )}
                                            {!!vm.account.username && (
                                                <Badge variant="default" icon="at-sign">{vm.account.username}</Badge>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            </Card>

                            <View style={{ flexDirection: stacked ? "column" : "row", gap: 20, alignItems: "flex-start" }}>
                                {/* ── Cuenta: solo lectura ── */}
                                <View style={{ width: stacked ? "100%" : 300, flexShrink: 0 }}>
                                    <Card variant="outlined">
                                        <CardHeading
                                            icon="user"
                                            title={t("Datos de la cuenta")}
                                            subtitle={t("Solo lectura")}
                                        />
                                        <InfoRow icon="credit-card" label={t("Documento")} value={doc} />
                                        <InfoRow icon="at-sign" label={t("Usuario")} value={vm.account.username} />
                                        <InfoRow icon="shield" label={t("Rol")} value={t(vm.account.roleLabel)} />
                                        <InfoRow icon="home" label={t("Sede")} value={vm.account.schoolName} />
                                        <View style={{
                                            flexDirection: "row", gap: 8, marginTop: 12, padding: 10,
                                            borderRadius: 10, backgroundColor: c.background.hover,
                                        }}>
                                            <Feather name="lock" size={14} color={c.text.secondary} style={{ marginTop: 2 }} />
                                            <Text style={{ flex: 1, fontSize: 12, color: c.text.secondary, lineHeight: 17 }}>
                                                {t("Nombre, documento, usuario, rol y sede los cambia la administración de tu institución.")}
                                            </Text>
                                        </View>
                                    </Card>
                                </View>

                                {/* ── Información personal: editable ── */}
                                <View style={{ flex: 1, width: stacked ? "100%" : undefined, minWidth: 0 }}>
                                    <Card variant="outlined">
                                        <CardHeading
                                            icon="edit-3"
                                            title={t("Información personal")}
                                            subtitle={t("Puedes actualizar estos datos cuando quieras")}
                                        />
                                        <View style={{ gap: 14 }}>
                                            {vm.saved && <Alert type="success" message={t("Perfil actualizado")} />}
                                            {!!vm.submitError && <Alert type="error" message={vm.submitError} />}

                                            <GroupLabel>{t("Contacto")}</GroupLabel>
                                            <TextInput
                                                label={t("Correo electrónico")}
                                                value={vm.values.email}
                                                onChangeText={(v) => vm.setField("email", v)}
                                                type="email"
                                                leftIcon={<Feather name="mail" size={18} color={c.text.secondary} />}
                                                helperText={t("Es tu identificador para iniciar sesión")}
                                                containerStyle={{ marginBottom: 4 }}
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
                                                    leftIcon={<Feather name="lock" size={18} color={c.text.secondary} />}
                                                    helperText={t("Necesaria para cambiar el correo")}
                                                    error={!!vm.errors.currentPassword}
                                                    errorMessage={vm.errors.currentPassword}
                                                />
                                            )}
                                            <TextInput
                                                label={t("Teléfono")}
                                                value={vm.values.phone}
                                                onChangeText={(v) => vm.setField("phone", v)}
                                                type="phone"
                                                leftIcon={<Feather name="phone" size={18} color={c.text.secondary} />}
                                                error={!!vm.errors.phone}
                                                errorMessage={vm.errors.phone}
                                            />
                                            <TextInput
                                                label={t("Dirección")}
                                                value={vm.values.address}
                                                onChangeText={(v) => vm.setField("address", v)}
                                                leftIcon={<Feather name="map-pin" size={18} color={c.text.secondary} />}
                                                error={!!vm.errors.address}
                                                errorMessage={vm.errors.address}
                                            />

                                            <GroupLabel>{t("Datos personales")}</GroupLabel>
                                            <View style={{ flexDirection: isSmall ? "column" : "row", gap: 14 }}>
                                                <View style={{ flex: 1 }}>
                                                    <DateInput
                                                        label={t("Fecha de nacimiento")}
                                                        value={vm.values.birthDate}
                                                        onChangeText={(v) => vm.setField("birthDate", v)}
                                                        leftIcon={<Feather name="calendar" size={18} color={c.text.secondary} />}
                                                        error={!!vm.errors.birthDate}
                                                        errorMessage={vm.errors.birthDate}
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
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
                                            </View>

                                            {/* ── Barra de acciones ── */}
                                            <View style={{
                                                flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap",
                                                marginTop: 6, paddingTop: 16,
                                                borderTopWidth: 1, borderTopColor: c.border.primary,
                                            }}>
                                                {vm.dirty ? (
                                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.status.warning }} />
                                                        <Text style={{ fontSize: 13, color: c.status.warning, fontWeight: "600" }}>
                                                            {t("Cambios sin guardar")}
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <View style={{ flex: 1 }} />
                                                )}
                                                <Button variant="outline" onPress={vm.discard} disabled={!vm.dirty || vm.saving}>
                                                    {t("Descartar")}
                                                </Button>
                                                <Button onPress={vm.save} disabled={!vm.dirty || vm.saving} loading={vm.saving}>
                                                    {vm.saving ? t("Guardando…") : t("Guardar cambios")}
                                                </Button>
                                            </View>
                                        </View>
                                    </Card>
                                </View>
                            </View>

                            <SecurityCard />
                        </>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
