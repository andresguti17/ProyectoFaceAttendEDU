// ============================================================
//  FaceAttend EDU — PeriodModal
//
//  Crear/editar período académico (HU-ACAD-002). Fechas en
//  formato AAAA-MM-DD (chk_period_dates: inicio < fin).
// ============================================================

import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Button, BaseModal, TextInput } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";

export default function PeriodModal({ visible, period, onClose, onSubmit }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    const [form, setForm] = useState({ name: "", startsOn: "", endsOn: "" });
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showErrors, setShowErrors] = useState(false);

    useEffect(() => {
        if (visible) {
            setForm({
                name: period?.name ?? "",
                startsOn: period ? String(period.startsOn ?? "").slice(0, 10) : "",
                endsOn: period ? String(period.endsOn ?? "").slice(0, 10) : "",
            });
            setError(null);
            setShowErrors(false);
            setSaving(false);
        }
    }, [visible, period]);

    if (!visible) return null;

    const setField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        if (showErrors) setError(null);
    };

    const handleSubmit = async () => {
        setShowErrors(true);
        setError(null);
        setSaving(true);
        const err = await onSubmit({ academicPeriodId: period?.academicPeriodId ?? null, ...form });
        setSaving(false);
        if (err) {
            setError(err);
        } else {
            onClose();
        }
    };

    const badDate = (v) => showErrors && (!/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "").trim()));

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title={period ? t("Editar período") : t("Nuevo período")}
            icon="calendar"
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
                    label={t("Nombre") + " *"}
                    value={form.name}
                    onChangeText={(v) => setField("name", v)}
                    placeholder={t("Ej: 2026-1")}
                    error={showErrors && !String(form.name ?? "").trim()}
                    errorMessage={t("Campo requerido")}
                />
                <TextInput
                    label={t("Inicio (AAAA-MM-DD)") + " *"}
                    value={form.startsOn}
                    onChangeText={(v) => setField("startsOn", v)}
                    placeholder={t("Ej: 2026-02-01")}
                    error={badDate(form.startsOn)}
                    errorMessage={t("Formato AAAA-MM-DD")}
                />
                <TextInput
                    label={t("Fin (AAAA-MM-DD)") + " *"}
                    value={form.endsOn}
                    onChangeText={(v) => setField("endsOn", v)}
                    placeholder={t("Ej: 2026-06-30")}
                    error={badDate(form.endsOn)}
                    errorMessage={t("Formato AAAA-MM-DD")}
                />
            </View>
        </BaseModal>
    );
}
