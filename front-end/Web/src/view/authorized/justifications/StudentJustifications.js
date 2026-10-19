// ============================================================
//  FaceAttend EDU — StudentJustifications
//
//  Vista del alumno (HU-JUS-001): sus justificaciones enviadas y
//  sus inasistencias/tardanzas todavía sin justificar.
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Badge, Button, Card, EmptyState } from "../../components/common";
import { useTheme } from "../../components/hooks/useTheme";
import { useResponsive } from "../../components/hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { REVIEW_STATUS_LABELS } from "../../../viewmodels/useJustificationsViewModel";

const REVIEW_META = {
    Pending: { variant: "warning", icon: "clock" },
    Approved: { variant: "success", icon: "check-circle" },
    Rejected: { variant: "danger", icon: "x-circle" },
};

const RECORD_META = {
    Absent: { variant: "danger", icon: "x-circle", label: "Ausente" },
    Late: { variant: "warning", icon: "clock", label: "Tardanza" },
};

function SegmentedTabs({ items, active, onChange }) {
    return (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {items.map((item) => (
                <Button
                    key={item.key}
                    variant={active === item.key ? "primary" : "outline"}
                    size="sm"
                    onPress={() => onChange(item.key)}
                >
                    {item.label}
                </Button>
            ))}
        </View>
    );
}

export function StudentJustifications({ vm }) {
    const { theme } = useTheme();
    const c = theme.colors;
    const { isSmall } = useResponsive();
    const { t } = useTranslation();

    const showEligible = vm.listTab === "eligible";

    return (
        <View style={{ gap: 16 }}>
            <SegmentedTabs
                active={vm.listTab}
                onChange={vm.setListTab}
                items={[
                    { key: "mine", label: `${t("Mis justificaciones")} (${vm.myJustifications.length})` },
                    { key: "eligible", label: `${t("Sin justificar")} (${vm.eligibleRecords.length})` },
                ]}
            />

            {showEligible ? (
                vm.eligibleRecords.length === 0 ? (
                    <EmptyState
                        icon="check-circle"
                        title={t("Sin registros pendientes de justificar")}
                        message={t("No tienes inasistencias o tardanzas pendientes de justificación")}
                    />
                ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                        {vm.eligibleRecords.map((record) => {
                            const meta = RECORD_META[record.attendanceStatus] || {
                                variant: "default",
                                icon: "help-circle",
                                label: record.attendanceStatus,
                            };
                            return (
                                <View
                                    key={record.attendanceRecordId}
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
                                                >
                                                    {record.date || "—"}
                                                </Text>
                                                <View style={{ flexShrink: 0 }}>
                                                    <Badge variant={meta.variant} size="sm" icon={meta.icon}>
                                                        {t(meta.label)}
                                                    </Badge>
                                                </View>
                                            </View>
                                            <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                                                {t("Registro de asistencia sin justificación")}
                                            </Text>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onPress={() => vm.openSubmit(record)}
                                                leftIcon={
                                                    <Feather name="file-plus" size={14} color={c.brand.textOnPrimary} />
                                                }
                                            >
                                                {t("Justificar")}
                                            </Button>
                                        </View>
                                    </Card>
                                </View>
                            );
                        })}
                    </View>
                )
            ) : vm.myJustifications.length === 0 ? (
                <EmptyState
                    icon="file-text"
                    title={t("Aún no has enviado justificaciones")}
                    message={t("Tus justificaciones enviadas aparecerán aquí con su estado de revisión")}
                />
            ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    {vm.myJustifications.map((item) => {
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
                                            >
                                                {item.date || "—"}
                                            </Text>
                                            <View style={{ flexShrink: 0 }}>
                                                <Badge variant={meta.variant} size="sm" icon={meta.icon}>
                                                    {t(REVIEW_STATUS_LABELS[item.reviewStatus] || item.reviewStatus)}
                                                </Badge>
                                            </View>
                                        </View>

                                        <Text style={{ color: c.text.primary, fontSize: 13, fontWeight: "600" }}>
                                            {vm.typeNameOf(item.justificationTypeId)}
                                        </Text>
                                        <Text
                                            style={{ color: c.text.secondary, fontSize: 13 }}
                                            numberOfLines={3}
                                        >
                                            {item.reason}
                                        </Text>

                                        <Text style={{ color: c.text.secondary, fontSize: 11 }}>
                                            {`${t("Enviada el")} ${String(item.submittedAt || "").replace("T", " ").slice(0, 16)}`}
                                        </Text>

                                        {item.reviewStatus !== "Pending" && item.resolutionNotes ? (
                                            <View
                                                style={{
                                                    backgroundColor: c.background.hover,
                                                    borderRadius: 8,
                                                    padding: 8,
                                                }}
                                            >
                                                <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                                                    {item.resolutionNotes}
                                                </Text>
                                            </View>
                                        ) : null}

                                        {item.reviewStatus === "Pending" && (
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onPress={() => vm.askWithdraw(item)}
                                            >
                                                {t("Retirar")}
                                            </Button>
                                        )}
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

export default StudentJustifications;
