// ============================================================
//  FaceAttend EDU — RegisterFichaModal
//  Alta de una ficha (cohorte): programa + período académico + código.
//  Ambos prerequisitos (programa, período) se pueden crear en línea
//  si la sede todavía no tiene ninguno — ver RegisterCourseModal para
//  el mismo patrón aplicado a "Nuevo programa".
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, AnimatedDropdown, BaseModal, TextInput } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useResponsive } from "../hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../../../context/AuthContext";
import { listSchoolPrograms, createProgram } from "../../../services/api/courseCreation";
import { listSchoolPeriods, createPeriod, createCohort } from "../../../services/api/fichaCreation";

const EMPTY_FORM = { code: "", programId: "", academicPeriodId: "" };

export default function RegisterFichaModal({ visible, onClose, onCreated }) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const { t } = useTranslation();
    const c = theme.colors;
    const { user } = useAuth();

    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [success, setSuccess] = useState(false);

    const [programs, setPrograms] = useState([]);
    const [periods, setPeriods] = useState([]);

    const [showNewProgram, setShowNewProgram] = useState(false);
    const [newProgramName, setNewProgramName] = useState("");
    const [newProgramCode, setNewProgramCode] = useState("");
    const [savingProgram, setSavingProgram] = useState(false);
    const [newProgramError, setNewProgramError] = useState(null);

    const [showNewPeriod, setShowNewPeriod] = useState(false);
    const [newPeriodName, setNewPeriodName] = useState("");
    const [newPeriodStart, setNewPeriodStart] = useState("");
    const [newPeriodEnd, setNewPeriodEnd] = useState("");
    const [savingPeriod, setSavingPeriod] = useState(false);
    const [newPeriodError, setNewPeriodError] = useState(null);

    const reloadPrograms = useCallback(() => {
        listSchoolPrograms(user?.schoolId ?? null).then(setPrograms, () => setPrograms([]));
    }, [user?.schoolId]);

    const reloadPeriods = useCallback(() => {
        listSchoolPeriods(user?.schoolId ?? null).then(setPeriods, () => setPeriods([]));
    }, [user?.schoolId]);

    useEffect(() => {
        if (!visible) return;
        reloadPrograms();
        reloadPeriods();
    }, [visible, reloadPrograms, reloadPeriods]);

    if (!visible) return null;

    const programItems = programs.map((p) => ({
        value: String(p.programId),
        label: p.code ? `${p.code} — ${p.name}` : p.name,
        icon: "book-open",
    }));
    const periodItems = periods.map((p) => ({
        value: String(p.academicPeriodId),
        label: `${p.name} (${p.startsOn} → ${p.endsOn})`,
        icon: "calendar",
    }));

    const setField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        if (showErrors) setError(null);
    };

    const resetAndClose = () => {
        setForm(EMPTY_FORM);
        setError(null);
        setShowErrors(false);
        setSuccess(false);
        setShowNewProgram(false);
        setNewProgramName("");
        setNewProgramCode("");
        setNewProgramError(null);
        setShowNewPeriod(false);
        setNewPeriodName("");
        setNewPeriodStart("");
        setNewPeriodEnd("");
        setNewPeriodError(null);
        onClose();
    };

    const handleCreateProgram = async () => {
        if (!newProgramName.trim() || !newProgramCode.trim()) {
            setNewProgramError(t("Nombre y código son requeridos"));
            return;
        }
        setSavingProgram(true);
        setNewProgramError(null);
        try {
            const created = await createProgram({
                schoolId: user?.schoolId ?? null,
                code: newProgramCode.trim(),
                name: newProgramName.trim(),
            });
            setPrograms((prev) => [...prev, created]);
            setField("programId", String(created.programId));
            setShowNewProgram(false);
            setNewProgramName("");
            setNewProgramCode("");
        } catch (e) {
            setNewProgramError(e?.message || t("No se pudo crear el programa"));
        } finally {
            setSavingProgram(false);
        }
    };

    const handleCreatePeriod = async () => {
        if (!newPeriodName.trim() || !newPeriodStart.trim() || !newPeriodEnd.trim()) {
            setNewPeriodError(t("Nombre y fechas son requeridos"));
            return;
        }
        setSavingPeriod(true);
        setNewPeriodError(null);
        try {
            const created = await createPeriod({
                schoolId: user?.schoolId ?? null,
                name: newPeriodName.trim(),
                startsOn: newPeriodStart.trim(),
                endsOn: newPeriodEnd.trim(),
                isActive: true,
            });
            setPeriods((prev) => [...prev, created]);
            setField("academicPeriodId", String(created.academicPeriodId));
            setShowNewPeriod(false);
            setNewPeriodName("");
            setNewPeriodStart("");
            setNewPeriodEnd("");
        } catch (e) {
            setNewPeriodError(e?.message || t("No se pudo crear el período"));
        } finally {
            setSavingPeriod(false);
        }
    };

    const handleSubmit = async () => {
        setShowErrors(true);
        setError(null);

        if (!form.code.trim() || !form.programId || !form.academicPeriodId) {
            setError(t("Completa los campos requeridos"));
            return;
        }

        setSaving(true);
        try {
            await createCohort({
                programId: form.programId,
                academicPeriodId: form.academicPeriodId,
                code: form.code.trim(),
            });
        } catch (e) {
            setSaving(false);
            setError(e?.message || t("No se pudo registrar la ficha en el backend"));
            return;
        }
        setSaving(false);
        setSuccess(true);
        onCreated?.();
        setTimeout(resetAndClose, 900);
    };

    const isEmpty = (v) => showErrors && !String(v ?? "").trim();

    return (
        <BaseModal
            visible={visible}
            onClose={resetAndClose}
            title={t("Nueva ficha")}
            subtitle={t("Completa los datos de la ficha")}
            icon="users"
            maxWidth={520}
            footer={
                <React.Fragment>
                    <Button variant="ghost" onPress={resetAndClose} disabled={saving}>
                        {t("Cancelar")}
                    </Button>
                    <Button variant="primary" onPress={handleSubmit} disabled={saving || success}>
                        {saving
                            ? <ActivityIndicator size="small" color={c.brand.textOnPrimary} />
                            : success
                                ? <React.Fragment><Feather name="check" size={14} color={c.brand.textOnPrimary} /> {t("¡Guardado!")}</React.Fragment>
                                : t("Registrar ficha")}
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

            <TextInput
                label={t("Código de la ficha")}
                value={form.code}
                onChangeText={v => setField("code", v)}
                placeholder={t("Ej: COH-2026-I-01")}
                error={isEmpty(form.code)}
                errorMessage={isEmpty(form.code) ? t("Campo requerido") : ""}
                leftIcon={<Feather name="hash" size={16} color={c.text.tertiary} />}
            />

            {/* Programa */}
            <View style={{ marginBottom: 2 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: showErrors && !form.programId ? c.status.error : c.text.secondary,
                    }}>
                        {t("Programa") + " *"}
                    </Text>
                    <Button variant="ghost" size="sm" onPress={() => { setNewProgramError(null); setShowNewProgram((v) => !v); }}>
                        <Feather name="plus-circle" size={13} color={c.brand.primary} />
                        {" " + t("Nuevo programa")}
                    </Button>
                </View>

                {showNewProgram && (
                    <View style={{ borderWidth: 1, borderColor: c.border.primary, borderRadius: 14, padding: 12, gap: 10, marginBottom: 10 }}>
                        <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 10 : 8 }}>
                            <View style={{ flex: 1 }}>
                                <TextInput label={t("Nombre del programa")} value={newProgramName} onChangeText={setNewProgramName}
                                    leftIcon={<Feather name="book" size={16} color={c.text.tertiary} />} />
                            </View>
                            <View style={{ width: isSmall ? "100%" : 140 }}>
                                <TextInput label={t("Código")} value={newProgramCode} onChangeText={setNewProgramCode}
                                    leftIcon={<Feather name="hash" size={16} color={c.text.tertiary} />} />
                            </View>
                        </View>
                        {newProgramError && <Text style={{ fontSize: 12, color: c.status.error }}>{newProgramError}</Text>}
                        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                            <Button variant="primary" size="sm" onPress={handleCreateProgram} disabled={savingProgram}>
                                {savingProgram ? <ActivityIndicator size="small" color={c.brand.textOnPrimary} /> : t("Crear programa")}
                            </Button>
                        </View>
                    </View>
                )}

                <AnimatedDropdown
                    items={programItems}
                    value={form.programId}
                    onSelect={v => setField("programId", v)}
                    placeholder={t("Seleccionar programa")}
                    searchable
                    searchPlaceholder={t("Buscar...")}
                    triggerIcon="book-open"
                    error={showErrors && !form.programId}
                    triggerHeight={48}
                />
            </View>

            {/* Período académico */}
            <View style={{ marginBottom: 2 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: showErrors && !form.academicPeriodId ? c.status.error : c.text.secondary,
                    }}>
                        {t("Período académico") + " *"}
                    </Text>
                    <Button variant="ghost" size="sm" onPress={() => { setNewPeriodError(null); setShowNewPeriod((v) => !v); }}>
                        <Feather name="plus-circle" size={13} color={c.brand.primary} />
                        {" " + t("Nuevo período")}
                    </Button>
                </View>

                {showNewPeriod && (
                    <View style={{ borderWidth: 1, borderColor: c.border.primary, borderRadius: 14, padding: 12, gap: 10, marginBottom: 10 }}>
                        <TextInput label={t("Nombre del período")} value={newPeriodName} onChangeText={setNewPeriodName}
                            placeholder={t("Ej: Primer Trimestre 2026")}
                            leftIcon={<Feather name="calendar" size={16} color={c.text.tertiary} />} />
                        <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 10 : 8 }}>
                            <View style={{ flex: 1 }}>
                                <TextInput label={t("Fecha de inicio")} value={newPeriodStart} onChangeText={setNewPeriodStart}
                                    placeholder="2026-01-15"
                                    leftIcon={<Feather name="calendar" size={16} color={c.text.tertiary} />} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <TextInput label={t("Fecha de fin")} value={newPeriodEnd} onChangeText={setNewPeriodEnd}
                                    placeholder="2026-04-15"
                                    leftIcon={<Feather name="calendar" size={16} color={c.text.tertiary} />} />
                            </View>
                        </View>
                        {newPeriodError && <Text style={{ fontSize: 12, color: c.status.error }}>{newPeriodError}</Text>}
                        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                            <Button variant="primary" size="sm" onPress={handleCreatePeriod} disabled={savingPeriod}>
                                {savingPeriod ? <ActivityIndicator size="small" color={c.brand.textOnPrimary} /> : t("Crear período")}
                            </Button>
                        </View>
                    </View>
                )}

                <AnimatedDropdown
                    items={periodItems}
                    value={form.academicPeriodId}
                    onSelect={v => setField("academicPeriodId", v)}
                    placeholder={t("Seleccionar período")}
                    searchable
                    searchPlaceholder={t("Buscar...")}
                    triggerIcon="calendar"
                    error={showErrors && !form.academicPeriodId}
                    triggerHeight={48}
                />
            </View>
        </BaseModal>
    );
}
