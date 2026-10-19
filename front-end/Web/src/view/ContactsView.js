// ============================================================
//  FaceAttend EDU — Contacts VIEW (Presentation Layer)
//
//  RESPONSABILIDAD: Directorio de instructores de la sede
//  (solo lectura). Antes era una pantalla propia; ahora se
//  embebe dentro de Configuración > Sede, junto con los datos
//  de la institución (hideSchoolSection evita duplicar la
//  tarjeta de la sede que ya pinta SchoolInfoView).
//
//  Toda la lógica de negocio está en useContactsViewModel.
// ============================================================

import React from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, Avatar, Card, EmptyState, PageHeader } from "./components/common";
import { useTheme } from "./components/hooks/useTheme";
import { useResponsive } from "./components/hooks/useResponsive";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useContactsViewModel } from "../viewmodels/useContactsViewModel";

function ContactLine({ icon, value }) {
    const { theme } = useTheme();
    const c = theme.colors;
    if (!value) return null;
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name={icon} size={14} color={c.text.secondary} />
            <Text style={{ color: c.text.primary, fontSize: 14 }}>{value}</Text>
        </View>
    );
}

export default function ContactsView({ embedded = false, hideSchoolSection = false }) {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const vm = useContactsViewModel();

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

    // Modo embebido (Configuración > Contactos): el PageHeader y el scroll
    // los aporta SettingsView, aquí solo se pinta el contenido.
    const Scroll = embedded ? View : ScrollView;
    const scrollProps = embedded
        ? {}
        : {
            contentContainerStyle: { padding: isSmall ? 16 : 24, gap: 24 },
            showsVerticalScrollIndicator: false,
        };

    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            {!embedded && (
                <PageHeader
                    title={t("Contactos")}
                    subtitle={
                        vm.school
                            ? t("Canales de contacto de tu sede y de tus instructores")
                            : t("Canales de contacto de los instructores")
                    }
                />
            )}

            <Scroll {...scrollProps}>
                {vm.error && <Alert type="error" title={t("No se pudo cargar")} message={vm.error} closable />}

                {/* Sede (oculta al embeberse en Sede: sus datos ya están arriba) */}
                {vm.school && !hideSchoolSection && (
                    <View style={{ gap: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Feather name="home" size={16} color={c.brand.primary} />
                            <Text style={{ fontSize: 16, fontWeight: "800", color: c.text.primary }}>
                                {vm.school.name}
                            </Text>
                        </View>
                        <Card variant="outlined">
                            <View style={{ gap: 8 }}>
                                <ContactLine icon="map-pin" value={vm.school.address} />
                                <ContactLine icon="phone" value={vm.school.phone} />
                                <ContactLine icon="mail" value={vm.school.email} />
                                {!vm.school.address && !vm.school.phone && !vm.school.email ? (
                                    <Text style={{ color: c.text.secondary, fontSize: 13 }}>
                                        {t("La sede no tiene datos de contacto registrados")}
                                    </Text>
                                ) : null}
                            </View>
                        </Card>
                    </View>
                )}

                {/* Instructores */}
                <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Feather name="users" size={16} color={c.brand.primary} />
                        <Text style={{ fontSize: 16, fontWeight: "800", color: c.text.primary }}>
                            {t("Instructores")}
                        </Text>
                        <Text style={{ fontSize: 13, color: c.text.secondary }}>({vm.instructors.length})</Text>
                    </View>

                    {vm.instructors.length === 0 ? (
                        <EmptyState
                            icon="users"
                            title={t("Sin instructores asignados")}
                            message={t("Aún no hay instructores vinculados a tu alcance")}
                        />
                    ) : (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                            {vm.instructors.map((person) => (
                                <Card
                                    key={person.id}
                                    variant="outlined"
                                    style={{ flexBasis: 280, flexGrow: 1 }}
                                >
                                    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                                        <Avatar name={person.name} size={40} />
                                        <View style={{ flex: 1, gap: 4 }}>
                                            <Text
                                                style={{ fontWeight: "700", color: c.text.primary }}
                                                numberOfLines={1}
                                            >
                                                {person.name}
                                            </Text>
                                            {person.courses ? (
                                                <Text style={{ color: c.text.secondary, fontSize: 12 }} numberOfLines={1}>
                                                    {person.courses}
                                                </Text>
                                            ) : null}
                                        </View>
                                    </View>
                                    <View style={{ gap: 6, marginTop: 10 }}>
                                        <ContactLine icon="mail" value={person.email} />
                                        <ContactLine icon="phone" value={person.phone} />
                                        {!person.email && !person.phone ? (
                                            <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                                                {t("Sin datos de contacto")}
                                            </Text>
                                        ) : null}
                                    </View>
                                </Card>
                            ))}
                        </View>
                    )}
                </View>
            </Scroll>
        </View>
    );
}
