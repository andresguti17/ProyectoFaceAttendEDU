// ============================================================
//  FaceAttend EDU — EditCourseModal
//  Edición de nombre/código/programa de un curso existente.
//  El guardado real es PUT /courses/{id}.
// ============================================================

import React, { useState, useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, AnimatedDropdown, BaseModal, TextInput } from "../../../components/common";
import { useTheme } from "../../../components/hooks/useTheme";
import { useResponsive } from "../../../components/hooks/useResponsive";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../../../../context/AuthContext";
import { listSchoolPrograms } from "../../../../services/api/courseCreation";

export default function EditCourseModal({ course, onClose, onSubmit }) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const { t } = useTranslation();
    const c = theme.colors;
    const { user } = useAuth();

    const [form, setForm] = useState(null);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [success, setSuccess] = useState(false);

    const [schoolPrograms, setSchoolPrograms] = useState([]);
    const [programsError, setProgramsError] = useState(null);

    useEffect(() => {
        if (!course) return;
        setForm({
            code: course.code ?? "",
            name: course.name ?? "",
            programId: course.programId != null ? String(course.programId) : "",
            creditHours: course.creditHours ?? course.credit_hours ?? "",
        });
        setError(null);
        setShowErrors(false);
        setSuccess(false);
    }, [course]);

    useEffect(() => {
        if (!course) return;
        let cancelled = false;
        setProgramsError(null);
        listSchoolPrograms(user?.schoolId ?? null).then(
            (list) => {
                if (!cancelled) setSchoolPrograms(list);
            },
            (e) => {
                if (!cancelled) {
                    setSchoolPrograms([]);
                    setProgramsError(e?.message || "No se pudieron cargar los programas");
                }
            }
        );
        return () => {
            cancelled = true;
        };
    }, [course, user?.schoolId]);

    if (!course || !form) return null;

    const programItems = schoolPrograms.map((p) => ({
        value: String(p.programId),
        label: p.code ? `${p.code} — ${p.name}` : p.name,
        icon: "book-open",
    }));

    const setField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        if (showErrors) setError(null);
    };

    const handleClose = () => {
        setError(null);
        setShowErrors(false);
        setSuccess(false);
        onClose();
    };

    const handleSubmit = async () => {
        setShowErrors(true);
        setError(null);

        if (!form.code.trim() || !form.name.trim() || !form.programId) {
            setError(t("Completa los campos requeridos"));
            return;
        }

        setSaving(true);
        const err = await onSubmit(form);
        setSaving(false);

        if (err) {
            setError(t(err));
        } else {
            setSuccess(true);
            setTimeout(() => {
                setShowErrors(false);
                setSuccess(false);
                onClose();
            }, 900);
        }
    };

    const isEmpty = (v) => showErrors && !v.trim();

    return (
        <BaseModal
            visible={!!course}
            onClose={handleClose}
            title={t("Editar curso")}
            subtitle={course.code}
            icon="edit-3"
            maxWidth={520}
            footer={
                <React.Fragment>
                    <Button variant="ghost" onPress={handleClose} disabled={saving}>
                        {t("Cancelar")}
                    </Button>
                    <Button variant="primary" onPress={handleSubmit} disabled={saving || success}>
                        {saving
                            ? <ActivityIndicator size="small" color={c.brand.textOnPrimary} />
                            : success
                                ? <React.Fragment><Feather name="check" size={14} color={c.brand.textOnPrimary} /> {t("¡Guardado!")}</React.Fragment>
                                : t("Guardar cambios")}
                    </Button>
                </React.Fragment>
            }
        >
            {error && (
                <View style={{
                    backgroundColor: c.status.errorLight || c.status.error + "20",
                    borderRadius: 14,
                    padding: 12,
                    flexDirection: "row",
                    gap: 8,
                    marginBottom: 14,
                }}>
                    <Feather name="alert-circle" size={14} color={c.status.error} />
                    <Text style={{ fontSize: 13, color: c.status.error, flex: 1 }}>{error}</Text>
                </View>
            )}

            <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 12 }}>
                <View style={{ flex: 1 }}>
                    <TextInput
                        label={t("Nombre del curso")}
                        value={form.name}
                        onChangeText={v => setField("name", v)}
                        error={isEmpty(form.name)}
                        errorMessage={isEmpty(form.name) ? t("Campo requerido") : ""}
                        leftIcon={<Feather name="book-open" size={16} color={c.text.tertiary} />}
                    />
                </View>
                <View style={{ width: isSmall ? "100%" : 160 }}>
                    <TextInput
                        label={t("Código")}
                        value={form.code}
                        onChangeText={v => setField("code", v)}
                        error={isEmpty(form.code)}
                        errorMessage={isEmpty(form.code) ? t("Campo requerido") : ""}
                        leftIcon={<Feather name="hash" size={16} color={c.text.tertiary} />}
                    />
                </View>
                <View style={{ width: isSmall ? "100%" : 120 }}>
                    <TextInput
                        label={t("Créditos")}
                        value={String(form.creditHours ?? "")}
                        onChangeText={v => setField("creditHours", v.replace(/[^\d]/g, ""))}
                        placeholder="3"
                        error={showErrors && String(form.creditHours ?? "").trim() !== "" && (!/^\d+$/.test(String(form.creditHours).trim()) || Number(form.creditHours) > 32767)}
                        errorMessage={t("0 a 32767")}
                        leftIcon={<Feather name="award" size={16} color={c.text.tertiary} />}
                    />
                </View>
            </View>

            <View style={{ marginBottom: 2 }}>
                <Text style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: (showErrors && !form.programId) || programsError ? c.status.error : c.text.secondary,
                    marginBottom: 6,
                }}>
                    {t("Programa") + " *"}
                </Text>
                <AnimatedDropdown
                    items={programItems}
                    value={form.programId}
                    onSelect={v => setField("programId", v)}
                    placeholder={t("Seleccionar programa")}
                    searchable={true}
                    searchPlaceholder={t("Buscar...")}
                    triggerIcon="book-open"
                    error={showErrors && !form.programId}
                    triggerHeight={48}
                />
                {programsError && (
                    <Text style={{ fontSize: 12, color: c.status.error, marginTop: 4 }}>
                        {programsError}
                    </Text>
                )}
            </View>
        </BaseModal>
    );
}
