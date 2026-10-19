// ============================================================
//  FaceAttend EDU — JustificationDetailModal
//
//  Detalle y evaluación de una justificación (HU-JUS-002 AC2..AC6):
//  alumno, fecha, estado del registro, motivo, soportes y decisión.
// ============================================================

import React, { useState } from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, Badge, BaseModal, Button, TextArea } from "../../components/common";
import { useTheme } from "../../components/hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { REVIEW_STATUS_LABELS } from "../../../viewmodels/useJustificationsViewModel";

const STATUS_META = {
    Pending: { variant: "warning", icon: "clock", label: "Pendiente" },
    Approved: { variant: "success", icon: "check-circle", label: "Aprobada" },
    Rejected: { variant: "danger", icon: "x-circle", label: "Rechazada" },
};

const RECORD_STATUS = {
    Absent: { variant: "danger", icon: "x-circle", label: "Ausente" },
    Late: { variant: "warning", icon: "clock", label: "Tardanza" },
    Justified: { variant: "info", icon: "file-text", label: "Justificada" },
    Present: { variant: "success", icon: "check-circle", label: "Presente" },
};

function bytesLabel(size) {
    if (!size) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function Field({ label, value }) {
    const { theme } = useTheme();
    const c = theme.colors;
    return (
        <View style={{ gap: 2 }}>
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
            <Text style={{ fontSize: 14, color: c.text.primary }}>{value || "—"}</Text>
        </View>
    );
}

export function JustificationDetailModal({
    row,
    typeName,
    documents,
    documentsLoading,
    notes,
    onNotesChange,
    onClose,
    onDecide,
}) {
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const [decisionError, setDecisionError] = useState(null);

    if (!row) return null;

    const statusMeta = STATUS_META[row.reviewStatus] || STATUS_META.Pending;
    const recordMeta = RECORD_STATUS[row.recordStatus] || {
        variant: "default",
        icon: "help-circle",
        label: row.recordStatus,
    };
    const isPending = row.reviewStatus === "Pending";

    const decide = (nextDecision) => {
        setDecisionError(null);
        if (nextDecision === "Approved" && !documentsLoading && documents.length === 0) {
            // RN-33: no se aprueba sin al menos un soporte válido.
            setDecisionError(t("No se puede aprobar: la justificación no tiene soporte registrado."));
            return;
        }
        onDecide(nextDecision);
    };

    return (
        <BaseModal
            visible={!!row}
            onClose={onClose}
            title={t("Detalle de la justificación")}
            subtitle={row.personName || "—"}
            icon="file-text"
            size="lg"
            footer={
                isPending ? (
                    <>
                        <Button variant="outline" onPress={onClose}>
                            {t("Cerrar")}
                        </Button>
                        <Button variant="danger" onPress={() => decide("Rejected")}>
                            {t("Rechazar")}
                        </Button>
                        <Button variant="primary" onPress={() => decide("Approved")}>
                            {t("Aprobar")}
                        </Button>
                    </>
                ) : (
                    <Button variant="primary" onPress={onClose}>
                        {t("Cerrar")}
                    </Button>
                )
            }
        >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                <Badge variant={statusMeta.variant} size="sm" icon={statusMeta.icon}>
                    {t(REVIEW_STATUS_LABELS[row.reviewStatus] || row.reviewStatus)}
                </Badge>
                <Badge variant={recordMeta.variant} size="sm" icon={recordMeta.icon}>
                    {t(recordMeta.label)}
                </Badge>
            </View>

            <View style={{ gap: 14, marginBottom: 16 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    <View style={{ flexBasis: 160, flexGrow: 1 }}>
                        <Field label={t("Alumno")} value={row.personName} />
                    </View>
                    <View style={{ flexBasis: 130, flexGrow: 1 }}>
                        <Field label={t("Fecha del registro")} value={row.date} />
                    </View>
                    <View style={{ flexBasis: 160, flexGrow: 1 }}>
                        <Field label={t("Tipo")} value={typeName} />
                    </View>
                    <View style={{ flexBasis: 160, flexGrow: 1 }}>
                        <Field
                            label={t("Enviada el")}
                            value={
                                row.submittedAt
                                    ? String(row.submittedAt).replace("T", " ").slice(0, 16)
                                    : ""
                            }
                        />
                    </View>
                </View>

                <View style={{ gap: 4 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: c.text.secondary,
                            textTransform: "uppercase",
                            letterSpacing: 0.3,
                        }}
                    >
                        {t("Motivo")}
                    </Text>
                    <Text style={{ fontSize: 14, color: c.text.primary }}>{row.reason || "—"}</Text>
                </View>
            </View>

            {/* Soportes */}
            <View
                style={{
                    backgroundColor: c.background.hover,
                    borderRadius: 12,
                    padding: 12,
                    gap: 8,
                    marginBottom: 16,
                }}
            >
                <Text
                    style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: c.text.secondary,
                        textTransform: "uppercase",
                        letterSpacing: 0.3,
                    }}
                >
                    {t("Soporte adjunto")}
                </Text>

                {documentsLoading ? (
                    <Text style={{ color: c.text.secondary, fontSize: 13 }}>{t("Cargando soportes...")}</Text>
                ) : documents.length === 0 ? (
                    <Alert
                        type="warning"
                        message={t("Esta justificación no tiene soportes registrados (RN-33).")}
                    />
                ) : (
                    documents.map((doc) => (
                        <View
                            key={doc.supportingDocumentId}
                            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                        >
                            <Feather name="paperclip" size={14} color={c.text.secondary} />
                            <Text style={{ color: c.text.primary, fontSize: 13, flex: 1 }} numberOfLines={1}>
                                {doc.fileName}
                            </Text>
                            <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                                {doc.mimeType} · {bytesLabel(doc.sizeBytes)}
                            </Text>
                        </View>
                    ))
                )}
            </View>

            {!isPending && row.resolutionNotes ? (
                <View style={{ gap: 4, marginBottom: 8 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: c.text.secondary,
                            textTransform: "uppercase",
                            letterSpacing: 0.3,
                        }}
                    >
                        {t("Observaciones de la evaluación")}
                    </Text>
                    <Text style={{ fontSize: 14, color: c.text.primary }}>{row.resolutionNotes}</Text>
                </View>
            ) : null}

            {isPending && (
                <View style={{ gap: 8 }}>
                    <TextArea
                        label={t("Observaciones")}
                        value={notes}
                        onChangeText={onNotesChange}
                        rows={3}
                        maxLength={300}
                        placeholder={t("Opcional: indica los motivos de la decisión...")}
                    />
                    {decisionError && <Alert type="error" message={decisionError} closable />}
                </View>
            )}
        </BaseModal>
    );
}

export default JustificationDetailModal;
