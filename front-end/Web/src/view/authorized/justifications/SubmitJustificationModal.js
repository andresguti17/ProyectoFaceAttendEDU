// ============================================================
//  FaceAttend EDU — SubmitJustificationModal
//
//  Registro de una justificación (HU-JUS-001 AC2..AC5):
//  tipo de justificación, motivo y soporte sobre una inasistencia
//  o tardanza elegible.
// ============================================================

import React, { useState } from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
    Alert,
    Badge,
    BaseModal,
    Button,
    FileUpload,
    Select,
    TextArea,
} from "../../components/common";
import { useTheme } from "../../components/hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { ALLOWED_DOC_TYPES, MAX_DOC_BYTES } from "../../../viewmodels/useJustificationsViewModel";

const RECORD_STATUS = {
    Absent: { variant: "danger", icon: "x-circle", label: "Ausente" },
    Late: { variant: "warning", icon: "clock", label: "Tardanza" },
};

export function SubmitJustificationModal({
    visible,
    target,
    types,
    submitting,
    errorMessage,
    onClose,
    onSubmit,
}) {
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();

    const [typeId, setTypeId] = useState("");
    const [reason, setReason] = useState("");
    const [file, setFile] = useState([]);
    const [localError, setLocalError] = useState(null);

    if (!visible || !target) return null;

    const selectedType = types.find((x) => String(x.justificationTypeId) === String(typeId));
    const requiresAttachment = !!selectedType?.requiresAttachment;
    const recordMeta = RECORD_STATUS[target.attendanceStatus] || {
        variant: "default",
        icon: "help-circle",
        label: target.attendanceStatus,
    };

    const handleSubmit = () => {
        if (!typeId) {
            setLocalError(t("Selecciona el tipo de justificación."));
            return;
        }
        if (!reason.trim()) {
            setLocalError(t("El motivo de la justificación es obligatorio."));
            return;
        }
        if (requiresAttachment && file.length === 0) {
            setLocalError(t("Este tipo de justificación requiere adjuntar un soporte."));
            return;
        }
        const picked = file[0];
        if (picked) {
            const extension = String(picked.name || "").split(".").pop()?.toLowerCase();
            if (!ALLOWED_DOC_TYPES.includes(extension)) {
                setLocalError(t("Formato no válido. Usa PDF, JPG, JPEG o PNG."));
                return;
            }
            if (picked.size && picked.size > MAX_DOC_BYTES) {
                setLocalError(t("El soporte supera el tamaño máximo de 5 MB."));
                return;
            }
        }
        setLocalError(null);
        onSubmit({ typeId, reason, file: picked || null });
    };

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title={t("Nueva justificación")}
            subtitle={t("Inasistencia o tardanza a justificar")}
            icon="file-text"
            size="md"
            footer={
                <>
                    <Button variant="outline" onPress={onClose} disabled={submitting}>
                        {t("Cancelar")}
                    </Button>
                    <Button
                        variant="primary"
                        onPress={handleSubmit}
                        loading={submitting}
                        leftIcon={<Feather name="send" size={16} color={c.brand.textOnPrimary} />}
                    >
                        {t("Enviar")}
                    </Button>
                </>
            }
        >
            <View
                style={{
                    backgroundColor: c.background.hover,
                    borderRadius: 12,
                    padding: 12,
                    gap: 4,
                    marginBottom: 16,
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Badge variant={recordMeta.variant} size="sm" icon={recordMeta.icon}>
                        {t(recordMeta.label)}
                    </Badge>
                    <Text style={{ color: c.text.primary, fontWeight: "700" }}>
                        {target.date || "—"}
                    </Text>
                </View>
                <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                    {t("La justificación quedará asociada a este registro de asistencia.")}
                </Text>
            </View>

            {(localError || errorMessage) && (
                <View style={{ marginBottom: 16 }}>
                    <Alert
                        type="error"
                        message={localError || errorMessage}
                        closable={!localError}
                        onClose={!localError ? onClose : undefined}
                    />
                </View>
            )}

            <View style={{ gap: 14 }}>
                <Select
                    label={t("Tipo de justificación")}
                    required
                    value={typeId}
                    onValueChange={setTypeId}
                    placeholder={t("Seleccionar tipo...")}
                    options={types.map((x) => ({
                        value: String(x.justificationTypeId),
                        label: x.requiresAttachment ? `${x.name} (${t("requiere soporte")})` : x.name,
                    }))}
                />

                <TextArea
                    label={t("Motivo")}
                    required
                    value={reason}
                    onChangeText={setReason}
                    rows={4}
                    maxLength={500}
                    placeholder={t("Describe el motivo de tu inasistencia o tardanza...")}
                />

                <View>
                    <Text
                        style={{
                            color: c.text.secondary,
                            fontSize: 12,
                            fontWeight: "600",
                            marginBottom: 6,
                        }}
                    >
                        {t("Soporte")}
                        {requiresAttachment ? ` * · ${t("requiere soporte")}` : ` · ${t("opcional")}`}
                    </Text>
                    <FileUpload
                        value={file}
                        onChange={setFile}
                        accept="*/*"
                        maxSize={MAX_DOC_BYTES}
                        label={t("Adjuntar documento (PDF, JPG, JPEG o PNG · máx. 5 MB)")}
                    />
                </View>
            </View>
        </BaseModal>
    );
}

export default SubmitJustificationModal;
