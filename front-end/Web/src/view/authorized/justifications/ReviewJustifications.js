// ============================================================
//  FaceAttend EDU — ReviewJustifications
//
//  Vista del instructor/administrador (HU-JUS-002): justificaciones
//  pendientes de su alcance y las ya resueltas.
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, Badge, Button, Card, EmptyState } from "../../components/common";
import { useTheme } from "../../components/hooks/useTheme";
import { useResponsive } from "../../components/hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { REVIEW_STATUS_LABELS } from "../../../viewmodels/useJustificationsViewModel";

const REVIEW_META = {
    Pending: { variant: "warning", icon: "clock" },
    Approved: { variant: "success", icon: "check-circle" },
    Rejected: { variant: "danger", icon: "x-circle" },
};

export function ReviewJustifications({ vm }) {
    const { theme } = useTheme();
    const c = theme.colors;
    const { isSmall } = useResponsive();
    const { t } = useTranslation();

    const showPending = vm.reviewTab === "pending";

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

            {vm.truncated ? (
                <Alert
                    type="info"
                    message={t("Se muestran los 100 registros de justificaciones más recientes. Usa los filtros de estado para acotar.")}
                    closable
                />
            ) : null}

            {vm.reviewRows.length === 0 ? (
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
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    {/* minWidth 240: sin él, el 30% con barra lateral fija da tarjetas
                        de 127px en pantallas medianas y los nombres quedan cortados. */}
                    {vm.reviewRows.map((item) => {
                        const meta = REVIEW_META[item.reviewStatus] || REVIEW_META.Pending;
                        return (
                            <View
                                key={item.justificationId}
                                style={{ flexBasis: isSmall ? "100%" : "30%", flexGrow: 1, minWidth: 240 }}
                            >
                                <Card variant="outlined">
                                    <View style={{ gap: 10 }}>
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
                                            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                                        >
                                            <Feather name="calendar" size={12} color={c.text.secondary} />
                                            <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                                                {item.date || "—"}
                                            </Text>
                                            <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                                                {`· ${vm.typeNameOf(item.justificationTypeId)}`}
                                            </Text>
                                        </View>

                                        <Text style={{ color: c.text.secondary, fontSize: 13 }} numberOfLines={3}>
                                            {item.reason}
                                        </Text>

                                        <Button
                                            variant={showPending ? "primary" : "outline"}
                                            size="sm"
                                            onPress={() => vm.openDetail(item)}
                                            leftIcon={<Feather name="eye" size={14} color={c.brand.textOnPrimary} />}
                                        >
                                            {showPending ? t("Evaluar") : t("Ver detalle")}
                                        </Button>
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
