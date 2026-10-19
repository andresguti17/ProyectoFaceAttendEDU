// ============================================================
//  FaceAttend EDU — Alerts VIEW (Presentation Layer)
//
//  Bandeja de alertas (HU-JUS-003): ver, marcar resuelta, eliminar.
//  Alcance propio (academicActorId de la sesión).
// ============================================================

import React, { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Alert, Badge, Button, Card, ConfirmModal, EmptyState, PageHeader } from "./components/common";
import { useTheme } from "./components/hooks/useTheme";
import { useResponsive } from "./components/hooks/useResponsive";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useRolePermissions } from "../viewmodels/useRolePermissions";
import { useAlertsViewModel } from "../viewmodels/useAlertsViewModel";

const SEVERITY_VARIANT = { INFO: "info", WARNING: "warning", CRITICAL: "danger" };

// Descripción humana + destino contextual por tipo de alerta.
// Sin mensaje en la entidad, el código solo no dice nada al usuario.
function describeAlert(code, t) {
    switch (String(code ?? "").trim().toUpperCase()) {
        case "JUSTIFICATION_RESULT":
            return {
                text: t("Se resolvió tu justificación. Revisa su estado."),
                target: "Justifications",
            };
        case "JUSTIFICATION_PENDING":
            return {
                text: t("Hay justificaciones pendientes de revisión."),
                target: "Justifications",
            };
        case "ATTENDANCE_ABSENTEEISM":
            return {
                text: t("Tienes inasistencias recurrentes. Revísalas en tu historial."),
                target: "History",
            };
        case "ATTENDANCE_TARDINESS":
            return {
                text: t("Tienes tardanzas repetidas. Revísalas en tu historial."),
                target: "History",
            };
        case "ATTENDANCE_LOW":
            return {
                text: t("Tu asistencia está por debajo del mínimo. Urgente."),
                target: "History",
            };
        case "BIOMETRIC_UPDATE":
            return {
                text: t("Hay una solicitud biométrica relacionada contigo."),
                target: "Biometrics",
            };
        default:
            return { text: "", target: null };
    }
}

export default function AlertsView() {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const vm = useAlertsViewModel();
    const navigation = useNavigation();
    const permissions = useRolePermissions();
    const [pendingDelete, setPendingDelete] = useState(null);

    if (vm.isLoading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={c.brand.primary} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            <PageHeader
                title={t("Alertas")}
                subtitle={`${vm.openCount} ${t("sin resolver")}`}
                actions={
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        <Button
                            variant={vm.showResolved ? "primary" : "outline"}
                            size="sm"
                            onPress={() => vm.setShowResolved(!vm.showResolved)}
                        >
                            {vm.showResolved ? t("Ocultar resueltas") : t("Ver resueltas")}
                        </Button>
                        <Button variant="ghost" size="sm" onPress={vm.refresh}>
                            {t("Actualizar")}
                        </Button>
                    </View>
                }
            />

            <ScrollView
                contentContainerStyle={{ padding: isSmall ? 16 : 24, gap: 16 }}
                showsVerticalScrollIndicator={false}
            >
                {vm.error && <Alert type="error" message={vm.error} />}

                {vm.alerts.length === 0 ? (
                    <EmptyState
                        icon="bell"
                        title={t("Sin alertas")}
                        message={
                            vm.showResolved
                                ? t("No tienes alertas registradas")
                                : t("No tienes alertas pendientes. Activa la vista de resueltas para ver el historial.")
                        }
                    />
                ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                        {vm.alerts.map((alert) => {
                            const id = alert.alertId ?? alert.alert_id ?? alert.id;
                            const typeId = alert.alertTypeId ?? alert.alert_type_id;
                            const type = vm.types.get(Number(typeId));
                            const resolved = !!(alert.resolvedAt ?? alert.resolved_at);
                            const raisedAt = String(alert.raisedAt ?? alert.raised_at ?? "").replace("T", " ").slice(0, 16);
                            const info = describeAlert(type?.code ?? type?.Code, t);
                            const canOpen = info.target != null && (
                                info.target === "Biometrics"
                                    ? (permissions.canEnrollOthersFace ?? permissions.canRegisterFace)
                                    : permissions.visibleTabs.includes(info.target.toLowerCase())
                            );
                            return (
                                <View key={id} style={{ flexBasis: isSmall ? "100%" : "30%", flexGrow: 1, minWidth: 260 }}>
                                    <Card variant="outlined">
                                        <View style={{ gap: 10 }}>
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                                <Feather
                                                    name={resolved ? "check-circle" : "bell"}
                                                    size={16}
                                                    color={resolved ? c.status.success : c.status.warning}
                                                />
                                                <Text style={{ fontWeight: "700", color: c.text.primary, flex: 1 }} numberOfLines={2}>
                                                    {type?.name ?? type?.Name ?? `${t("Alerta")} #${id}`}
                                                </Text>
                                                <Badge variant={resolved ? "success" : SEVERITY_VARIANT[type?.severity ?? type?.Severity] || "warning"} size="sm">
                                                    {resolved ? t("Resuelta") : (type?.severity ?? "") || t("Pendiente")}
                                                </Badge>
                                            </View>
                                            <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                                                {type?.code ?? ""}{raisedAt ? ` · ${raisedAt}` : ""}
                                            </Text>
                                            {info.text ? (
                                                <Text style={{ color: c.text.primary, fontSize: 13 }}>
                                                    {info.text}
                                                </Text>
                                            ) : null}
                                            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                                                {canOpen && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onPress={() => navigation.navigate(info.target)}
                                                    >
                                                        {t("Ver")}
                                                    </Button>
                                                )}
                                                {!resolved && (
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        disabled={vm.busyId === id}
                                                        onPress={() => vm.resolve(alert)}
                                                    >
                                                        {t("Marcar resuelta")}
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    disabled={vm.busyId === id}
                                                    onPress={() => setPendingDelete(alert)}
                                                >
                                                    {t("Eliminar")}
                                                </Button>
                                            </View>
                                        </View>
                                    </Card>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {pendingDelete != null && (
                <ConfirmModal
                    visible
                    onClose={() => setPendingDelete(null)}
                    onConfirm={() => {
                        vm.remove(pendingDelete).finally(() => setPendingDelete(null));
                    }}
                    loading={vm.busyId != null}
                    variant="danger"
                    title={t("Eliminar alerta")}
                    message={t("Se eliminará la alerta. ¿Continuar?")}
                    confirmText={t("Eliminar")}
                />
            )}
        </View>
    );
}
