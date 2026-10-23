// ============================================================
//  FaceAttend EDU — PeriodModal
//
//  Crear/editar período académico (HU-ACAD-002). Fechas en
//  formato AAAA-MM-DD (chk_period_dates: inicio < fin).
// ============================================================

import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Button, BaseModal, TextInput } from "../common";
import { DateInput } from "../common/inputs/DateInput";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { ACADEMIC_PERIOD_CONFIG, getConfiguredAcademicPeriodType } from "../../../core/constants/academicPeriods";
import { periodNameFor } from "../../../services/api/periodSync";

const ISO = /^d{4}-d{2}-d{2}$/;

// Fin sugerido: el día anterior al aniversario del inicio según la duración del tipo de período.
function suggestedEnd(startIso, months) {
    const [y, m, d] = startIso.split("-").map(Number);
    const end = new Date(y, m - 1 + months, d - 1);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

export default function PeriodModal({ visible, period, onClose, onSubmit }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    // El tipo (anual, semestral…) se define en Configuración y rige la duración del período.
    const periodType = getConfiguredAcademicPeriodType();
    const typeConfig = ACADEMIC_PERIOD_CONFIG[periodType];

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
        setForm((prev) => {
            const next = { ...prev, [key]: value };
            // Al completar el inicio se proponen fin y nombre según el tipo configurado.
            if (key === "startsOn" && ISO.test(value)) {
                if (!prev.endsOn) next.endsOn = suggestedEnd(value, typeConfig.durationMonths);
                if (!String(prev.name ?? "").trim()) next.name = periodNameFor(periodType, value);
            }
            return next;
        });
        if (showErrors) setError(null);
    };

    const handleSubmit = async () => {
        setShowErrors(true);
        setError(null);
        if (form.startsOn && form.endsOn && form.startsOn >= form.endsOn) {
            setError(t("La fecha de fin debe ser posterior a la de inicio"));
            return;
        }
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
            <Text style={{ fontSize: 12, color: c.text.secondary, marginBottom: 8 }}>
                {`${t("Tipo de período")}: ${t(typeConfig.labelKey)} · ${t("máximo")} ${typeConfig.durationMonths} ${t("meses")} (${t("se cambia en Configuración")})`}
            </Text>
            <View style={{ gap: 0 }}>
                <TextInput
                    label={t("Nombre") + " *"}
                    value={form.name}
                    onChangeText={(v) => setField("name", v)}
                    placeholder={t("Ej: 2026-1")}
                    error={showErrors && !String(form.name ?? "").trim()}
                    errorMessage={t("Campo requerido")}
                />
                <DateInput
                    label={t("Inicio") + " *"}
                    value={form.startsOn}
                    onChangeText={(v) => setField("startsOn", v)}
                    error={badDate(form.startsOn)}
                    errorMessage={t("Fecha incompleta o inválida")}
                />
                <DateInput
                    label={t("Fin") + " *"}
                    value={form.endsOn}
                    onChangeText={(v) => setField("endsOn", v)}
                    error={badDate(form.endsOn)}
                    errorMessage={t("Fecha incompleta o inválida")}
                />
            </View>
        </BaseModal>
    );
}
