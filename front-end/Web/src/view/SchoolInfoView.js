// ============================================================
//  FaceAttend EDU — SchoolInfo VIEW (Presentation Layer)
//
//  RESPONSABILIDAD: Información de la sede en modo lectura para
//  alumno e instructor y edición para el administrador.
//
//  Toda la lógica de negocio está en useSchoolInfoViewModel.
// ============================================================

import React from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
    Alert,
    AnimatedDropdown,
    Badge,
    BaseModal,
    Button,
    Card,
    ConfirmModal,
    EmptyState,
    PageHeader,
    Select,
    TextInput,
} from "./components/common";
import { useTheme } from "./components/hooks/useTheme";
import { useResponsive } from "./components/hooks/useResponsive";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useSchoolInfoViewModel } from "../viewmodels/useSchoolInfoViewModel";
import { useCityOptions } from "../viewmodels/useCityOptions";

function InfoField({ label, value, icon }) {
    const { theme } = useTheme();
    const c = theme.colors;
    return (
        <View style={{ flexBasis: 220, flexGrow: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name={icon} size={12} color={c.text.secondary} />
                <Text
                    style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: c.text.secondary,
                        textTransform: "uppercase",
                        letterSpacing: 0.3,
                    }}
                >
                    {label}
                </Text>
            </View>
            <Text style={{ fontSize: 14, color: c.text.primary }}>{value || "—"}</Text>
        </View>
    );
}

export default function SchoolInfoView({ embedded = false }) {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const vm = useSchoolInfoViewModel();

    if (vm.isLoading) {
        return (
            <View
                style={
                    embedded
                        ? { padding: 24, alignItems: "center" }
                        : { flex: 1, alignItems: "center", justifyContent: "center" }
                }
            >
                <ActivityIndicator size="large" color={c.brand.primary} />
            </View>
        );
    }

    // Modo embebido (Configuración > Sede): el PageHeader y el scroll los
    // aporta SettingsView, aquí solo se pinta el contenido.
    const Scroll = embedded ? View : ScrollView;
    const scrollProps = embedded
        ? {}
        : {
            contentContainerStyle: { padding: isSmall ? 16 : 24, gap: 16 },
            showsVerticalScrollIndicator: false,
        };

    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            {!embedded && (
                <PageHeader
                    title={t("Información de la sede")}
                    subtitle={vm.school ? vm.school.name : t("Datos de la institución")}
                    actions={
                        vm.canEdit &&
                        vm.school && (
                            <Button
                                variant="primary"
                                size="sm"
                                onPress={vm.openEdit}
                                leftIcon={<Feather name="edit-2" size={16} color={c.brand.textOnPrimary} />}
                            >
                                {t("Editar")}
                            </Button>
                        )
                    }
                />
            )}

            <Scroll {...scrollProps}>
                {/* Modo embebido (Configuración > Sede): el botón vive aquí,
                    porque el PageHeader con sus acciones queda fuera. */}
                {embedded && vm.canEdit && vm.school && (
                    <View style={{ alignItems: "flex-end", marginBottom: 12 }}>
                        <Button
                            variant="primary"
                            size="sm"
                            onPress={vm.openEdit}
                            leftIcon={<Feather name="edit-2" size={16} color={c.brand.textOnPrimary} />}
                        >
                            {t("Editar")}
                        </Button>
                    </View>
                )}

                {vm.error && (
                    <Alert type="error" title={t("Sin información")} message={vm.error} closable />
                )}
                {vm.feedback && (
                    <Alert
                        type={vm.feedback.type === "success" ? "success" : "error"}
                        message={vm.feedback.message}
                        closable
                        onClose={vm.clearFeedback}
                    />
                )}

                {/* Cuenta sin sede propia (administrador): se elige qué sede consultar */}
                {vm.canChooseSchool ? (
                    <Select
                        label={t("Sede")}
                        value={vm.selectedSchoolId}
                        onValueChange={vm.selectSchool}
                        options={vm.schools.map((s) => ({
                            label: s.code ? `${s.name} (${s.code})` : s.name,
                            value: s.schoolId,
                        }))}
                        placeholder={t("Seleccionar sede...")}
                        searchable
                    />
                ) : null}

                {!vm.school ? (
                    <EmptyState
                        icon="map-pin"
                        title={t("Sin información de la sede")}
                        message={
                            vm.canChooseSchool
                                ? t("Selecciona una sede arriba para consultar su información")
                                : t("No hay datos disponibles para tu sede")
                        }
                    />
                ) : (
                    <Card variant="outlined">
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
                            <InfoField label={t("Nombre")} value={vm.school.name} icon="home" />
                            <InfoField label={t("Código")} value={vm.school.code} icon="hash" />
                            <InfoField label={t("Dirección")} value={vm.school.address} icon="map" />
                            <InfoField
                                label={t("Ciudad")}
                                value={vm.school.cityName ?? null}
                                icon="map-pin"
                            />
                            <InfoField label={t("Teléfono")} value={vm.school.phone} icon="phone" />
                            <InfoField label={t("Correo")} value={vm.school.email} icon="mail" />
                            <View style={{ flexBasis: 140, flexGrow: 1, gap: 4 }}>
                                <Text
                                    style={{
                                        fontSize: 11,
                                        fontWeight: "700",
                                        color: c.text.secondary,
                                        textTransform: "uppercase",
                                        letterSpacing: 0.3,
                                    }}
                                >
                                    {t("Estado")}
                                </Text>
                                <View>
                                    <Badge
                                        variant={vm.school.status ? "success" : "danger"}
                                        size="sm"
                                        icon={vm.school.status ? "check-circle" : "x-circle"}
                                    >
                                        {vm.school.status ? t("Activa") : t("Inactiva")}
                                    </Badge>
                                </View>
                            </View>
                        </View>
                    </Card>
                )}

                {!vm.canEdit && vm.school ? (
                    <Alert
                        type="info"
                        message={t("Tu rol puede consultar la información de la sede. Solo el administrador puede modificarla.")}
                    />
                ) : null}
            </Scroll>

            {/* Edición (solo admin) */}
            {vm.editOpen && <EditModal vm={vm} t={t} />}

            <ConfirmModal
                visible={vm.confirmOpen}
                onClose={() => vm.setConfirmOpen(false)}
                onConfirm={vm.save}
                title={t("Guardar cambios")}
                message={t("¿Deseas actualizar la información de la sede?")}
                variant="warning"
                confirmText={t("Guardar")}
                cancelText={t("Cancelar")}
                loading={vm.isSaving}
            />
        </View>
    );
}

function EditModal({ vm, t }) {
    const { theme } = useTheme();
    const c = theme.colors;
    const cityItems = useCityOptions();
    return (
        <BaseModal
            visible={vm.editOpen}
            onClose={vm.closeEdit}
            title={t("Editar información de la sede")}
            icon="edit-2"
            size="md"
            footer={
                <>
                    <Button variant="outline" onPress={vm.closeEdit} disabled={vm.isSaving}>
                        {t("Cancelar")}
                    </Button>
                    <Button
                        variant="primary"
                        onPress={() => vm.setConfirmOpen(true)}
                        loading={vm.isSaving}
                    >
                        {t("Guardar")}
                    </Button>
                </>
            }
        >
            {vm.feedback && vm.feedback.type === "error" ? (
                <View style={{ marginBottom: 16 }}>
                    <Alert type="error" message={vm.feedback.message} closable onClose={vm.clearFeedback} />
                </View>
            ) : null}

            <View style={{ gap: 14 }}>
                <TextInput
                    label={t("Nombre")}
                    required
                    value={vm.form.name}
                    onChangeText={(v) => vm.setField("name", v)}
                />
                <TextInput
                    label={t("Código")}
                    value={vm.form.code}
                    onChangeText={(v) => vm.setField("code", v)}
                />
                <TextInput
                    label={t("Dirección")}
                    value={vm.form.address}
                    onChangeText={(v) => vm.setField("address", v)}
                />
                <View>
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: c.text.secondary,
                            marginBottom: 6,
                        }}
                    >
                        {t("Ciudad")}
                    </Text>
                    <AnimatedDropdown
                        items={cityItems}
                        value={vm.form.cityName}
                        onSelect={(v) => vm.setField("cityName", v)}
                        placeholder={t("Seleccionar ciudad")}
                        triggerIcon="map-pin"
                        searchable
                        searchPlaceholder={t("Buscar ciudad...")}
                        triggerHeight={48}
                    />
                </View>
                <TextInput
                    label={t("Teléfono")}
                    type="phone"
                    value={vm.form.phone}
                    onChangeText={(v) => vm.setField("phone", v)}
                />
                <TextInput
                    label={t("Correo")}
                    type="email"
                    value={vm.form.email}
                    onChangeText={(v) => vm.setField("email", v)}
                />
            </View>
        </BaseModal>
    );
}
