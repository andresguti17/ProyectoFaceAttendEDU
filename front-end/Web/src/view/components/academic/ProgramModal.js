// ============================================================
//  FaceAttend EDU — ProgramModal
//
//  Crear/editar programa (HU-ACAD-002, FR 2.2). La validación de
//  fondo vive en el ViewModel; aquí solo el formulario.
// ============================================================

import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Button, BaseModal, TextInput } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";

export default function ProgramModal({ visible, program, onClose, onSubmit }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    const [form, setForm] = useState({ code: "", name: "" });
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showErrors, setShowErrors] = useState(false);

    useEffect(() => {
        if (visible) {
            setForm({
                code: program?.code ?? "",
                name: program?.name ?? "",
            });
            setError(null);
            setShowErrors(false);
            setSaving(false);
        }
    }, [visible, program]);

    if (!visible) return null;

    const setField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        if (showErrors) setError(null);
    };

    const handleSubmit = async () => {
        setShowErrors(true);
        setError(null);
        setSaving(true);
        const err = await onSubmit({ programId: program?.programId ?? null, ...form });
        setSaving(false);
        if (err) {
            setError(err);
        } else {
            onClose();
        }
    };

    const isEmpty = (v) => showErrors && !String(v ?? "").trim();

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title={program ? t("Editar programa") : t("Nuevo programa")}
            icon="layers"
            iconColor={c.brand.primary}
            size="sm"
            footer={
                <>
                    <Button variant="outline" onPress={onClose} disabled={saving}>
                        {t("Cancelar")}
                    </Button>
                    <Button variant="primary" onPress={handleSubmit} loading={saving}>
                        {t("Guardar")}
                    </Button>
                </>
            }
        >
            {error && (
                <View
                    style={{
                        backgroundColor: c.status.dangerLight,
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 14,
                    }}
                >
                    <Text style={{ fontSize: 13, color: c.status.danger }}>{error}</Text>
                </View>
            )}
            <View style={{ gap: 0 }}>
                <TextInput
                    label={t("Código") + " *"}
                    value={form.code}
                    onChangeText={(v) => setField("code", v)}
                    placeholder={t("Ej: ADSO")}
                    error={isEmpty(form.code)}
                    errorMessage={isEmpty(form.code) ? t("Campo requerido") : ""}
                />
                <TextInput
                    label={t("Nombre") + " *"}
                    value={form.name}
                    onChangeText={(v) => setField("name", v)}
                    placeholder={t("Ej: Análisis y Desarrollo de Software")}
                    error={isEmpty(form.name)}
                    errorMessage={isEmpty(form.name) ? t("Campo requerido") : ""}
                />
            </View>
        </BaseModal>
    );
}
