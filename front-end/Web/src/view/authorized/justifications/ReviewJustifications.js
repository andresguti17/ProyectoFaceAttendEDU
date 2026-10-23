// ============================================================
//  FaceAttend EDU — ReviewJustifications
//
//  Vista del instructor/administrador (HU-JUS-002): justificaciones
//  pendientes de su alcance y las ya resueltas. Las resueltas se
//  separan en válidas (aprobadas) y rechazadas y cada tarjeta muestra
//  el recorrido enviada → resuelta con quién/cuándo y la observación.
// ============================================================

import React, { useMemo, useState } from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, Badge, Button, Card, EmptyState } from "../../components/common";
import { useTheme } from "../../components/hooks/useTheme";
import { useResponsive } from "../../components/hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { REVIEW_STATUS_LABELS } from "../../../viewmodels/useJustificationsViewModel";

const REVIEW_META = {
    Pending: { variant: "warning", icon: "clock", color: "warning" },
    Approved: { variant: "success", icon: "check-circle", color: "success" },
    Rejected: { variant: "danger", icon: "x-circle", color: "danger" },
};

const shortStamp = (value) => String(value || "").replace("T", " ").slice(0, 16) || "—";

/** Un paso del recorrido (enviada / resuelta): punto, rótulo y fecha. */
function FlowStep({ icon, color, label, stamp, c }) {
    return (
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
            <View
                style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: color,
                    flexShrink: 0,
                }}
            >
                <Feather name={icon} size={12} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: c.text.primary }} numberOfLines={1}>
                    {label}
                </Text>
                <Text style={{ fontSize: 11, color: c.text.secondary }} numberOfLines={1}>
                    {stamp}
                </Text>
            </View>
        </View>
    );
}

export function ReviewJustifications({ vm }) {
    const { theme } = useTheme();
    const c = theme.colors;
    const { isSmall } = useResponsive();
    const { t } = useTranslation();
    const [resolvedFilter, setResolvedFilter] = useState("all");

    const showPending = vm.reviewTab === "pending";

    const approvedCount = useMemo(
        () => (showPending ? 0 : vm.reviewRows.filter((r) => r.reviewStatus === "Approved").length),
        [vm.reviewRows, showPending]
    );
    const rejectedCount = showPending ? 0 : vm.reviewRows.length - approvedCount;

    const rows = useMemo(() => {
        if (showPending || resolvedFilter === "all") return vm.reviewRows;
        return vm.reviewRows.filter((r) => r.reviewStatus === resolvedFilter);
    }, [vm.reviewRows, showPending, resolvedFilter]);

    return (
        <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Button
                    variant={showPending ? "primary" : "outline"}
                    size="sm"
                    onPress={() => vm.setReviewTab("pending")}
                >
                    {`${t("Pendientes")} (${vm.pendingCount})`}
                </Button>
                <Button
                    variant={!showPending ? "primary" : "outline"}
                    size="sm"
                    onPress={() => vm.setReviewTab("resolved")}
                >
                    {`${t("Resueltas")} (${vm.resolvedCount})`}
                </Button>
            </View>

            {!showPending && vm.reviewRows.length > 0 ? (
                <View
                    style={{
                        flexDirection: "row",
                        gap: 8,
                        flexWrap: "wrap",
                        paddingBottom: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: c.border.primary,
                    }}
                >
                    {[
                        { key: "all", label: `${t("Todas")} (${vm.reviewRows.length})` },
                        { key: "Approved", label: `${t("Válidas")} (${approvedCount})` },
                        { key: "Rejected", label: `${t("Rechazadas")} (${rejectedCount})` },
                    ].map((chip) => (
                        <Button
                            key={chip.key}
                            variant={resolvedFilter === chip.key ? "secondary" : "ghost"}
                            size="sm"
                            onPress={() => setResolvedFilter(chip.key)}
                        >
                            {chip.label}
                        </Button>
                    ))}
                </View>
            ) : null}

            {vm.truncated ? (
                <Alert
                    type="info"
                    message={t("Se muestran los 100 registros de justificaciones más recientes. Usa los filtros de estado para acotar.")}
                    closable
                />
            ) : null}

            {rows.length === 0 ? (
                <EmptyState
                    icon="inbox"
                    title={showPending ? t("Sin justificaciones pendientes") : t("Sin justificaciones resueltas")}
                    message={
                        showPending
                            ? t("No hay justificaciones pendientes de revisión en tu alcance")
                            : t("Las justificaciones evaluadas aparecerán aquí")
                    }
                />
            ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
                    {/* minWidth 240: sin él, el 30% con barra lateral fija da tarjetas
                        de 127px en pantallas medianas y los nombres quedan cortados. */}
                    {rows.map((item) => {
                        const meta = REVIEW_META[item.reviewStatus] || REVIEW_META.Pending;
                        const accent = c.status[meta.color];
                        const resolved = item.reviewStatus !== "Pending";
                        return (
                            <View
                                key={item.justificationId}
                                style={{ flexBasis: isSmall ? "100%" : "30%", flexGrow: 1, minWidth: 240 }}
                            >
                                <Card variant="outlined" style={{ flex: 1, borderLeftWidth: 4, borderLeftColor: accent }}>
                                    <View style={{ gap: 10, flex: 1 }}>
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                gap: 8,
                                            }}
                                        >
                                            <Text
                                                style={{ fontWeight: "700", color: c.text.primary, flex: 1 }}
                                                numberOfLines={1}
                                            >
                                                {item.personName || "—"}
                                            </Text>
                                            <View style={{ flexShrink: 0 }}>
                                                <Badge variant={meta.variant} size="sm" icon={meta.icon}>
                                                    {t(REVIEW_STATUS_LABELS[item.reviewStatus] || item.reviewStatus)}
                                                </Badge>
                                            </View>
                                        </View>

                                        <View
                                            style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}
                                        >
                                            <Feather name="calendar" size={12} color={c.text.secondary} />
                                            <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                                                {item.date || "—"}
                                            </Text>
                                            <Text style={{ color: c.text.secondary, fontSize: 12, flexShrink: 1 }}>
                                                {`· ${vm.typeNameOf(item.justificationTypeId)}`}
                                            </Text>
                                        </View>

                                        <Text style={{ color: c.text.secondary, fontSize: 13 }} numberOfLines={3}>
                                            {item.reason}
                                        </Text>

                                        {resolved ? (
                                            <View
                                                style={{
                                                    flexDirection: "row",
                                                    gap: 8,
                                                    paddingVertical: 8,
                                                    borderTopWidth: 1,
                                                    borderBottomWidth: 1,
                                                    borderColor: c.border.primary,
                                                }}
                                            >
                                                <FlowStep
                                                    icon="send"
                                                    color={c.text.secondary}
                                                    label={t("Enviada")}
                                                    stamp={shortStamp(item.submittedAt)}
                                                    c={c}
                                                />
                                                <FlowStep
                                                    icon={meta.icon}
                                                    color={accent}
                                                    label={t(REVIEW_STATUS_LABELS[item.reviewStatus] || item.reviewStatus)}
                                                    stamp={shortStamp(item.reviewedAt)}
                                                    c={c}
                                                />
                                            </View>
                                        ) : null}

                                        {resolved && item.resolutionNotes ? (
                                            <View
                                                style={{
                                                    backgroundColor: c.background.hover,
                                                    borderRadius: 8,
                                                    padding: 8,
                                                }}
                                            >
                                                <Text style={{ color: c.text.secondary, fontSize: 12 }} numberOfLines={3}>
                                                    {item.resolutionNotes}
                                                </Text>
                                            </View>
                                        ) : null}

                                        <View style={{ flex: 1, justifyContent: "flex-end" }}>
                                            <Button
                                                variant={showPending ? "primary" : "outline"}
                                                size="sm"
                                                onPress={() => vm.openDetail(item)}
                                                leftIcon={
                                                    <Feather
                                                        name="eye"
                                                        size={14}
                                                        color={showPending ? c.brand.textOnPrimary : c.text.primary}
                                                    />
                                                }
                                            >
                                                {showPending ? t("Evaluar") : t("Ver detalle")}
                                            </Button>
                                        </View>
                                    </View>
                                </Card>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

export default ReviewJustifications;
