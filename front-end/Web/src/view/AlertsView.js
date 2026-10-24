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
import { formatDateTime } from "../core/utils/locale";

const SEVERITY_VARIANT = { INFO: "info", WARNING: "warning", CRITICAL: "danger" };

// Destino contextual por tipo de alerta. El texto sale de alerts.types.<CODE>.*:
// la entidad no trae mensaje y el nombre del catálogo viene en inglés.
const ALERT_TARGETS = {
    JUSTIFICATION_RESULT: "Justifications",
    JUSTIFICATION_APPROVED: "Justifications",
    JUSTIFICATION_REJECTED: "Justifications",
    JUSTIFICATION_PENDING: "Justifications",
    ATTENDANCE_ABSENTEEISM: "History",
    ATTENDANCE_TARDINESS: "History",
    ATTENDANCE_LOW: "History",
    BIOMETRIC_UPDATE: "Biometrics",
};

function describeAlert(type, id, t) {
    const code = String(type?.code ?? type?.Code ?? "").trim().toUpperCase();
    const known = code in ALERT_TARGETS;
    const fallbackTitle = type?.name ?? type?.Name ?? `${t("Alerta")} #${id}`;
    return {
        title: known ? t(`alerts.types.${code}.title`) : fallbackTitle,
        text: known ? t(`alerts.types.${code}.body`) : "",
        target: ALERT_TARGETS[code] ?? null,
    };
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
                            const raisedAt = formatDateTime(alert.raisedAt ?? alert.raised_at);
                            const severity = type?.severity ?? type?.Severity;
                            const info = describeAlert(type, id, t);
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
                                                    {info.title}
                                                </Text>
                                                <Badge variant={resolved ? "success" : SEVERITY_VARIANT[severity] || "warning"} size="sm">
                                                    {resolved ? t("Resuelta") : SEVERITY_VARIANT[severity] ? t(`alerts.severity.${severity}`) : t("Pendiente")}
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
