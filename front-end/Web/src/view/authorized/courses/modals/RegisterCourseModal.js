// ============================================================
//  FaceAttend EDU — RegisterCourseModal
//  Modal para registrar un nuevo curso/ficha.
//  Usa TextInput y AnimatedDropdown de componentes comunes.
//  La validación se hace en el ViewModel, no aquí.
// ============================================================

import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, AnimatedDropdown, BaseModal, TextInput } from "../../../components/common";
import { useTheme } from "../../../components/hooks/useTheme";
import { useResponsive } from "../../../components/hooks/useResponsive";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { useAppData } from "../../../../context/AppDataContext";
import { useAuth } from "../../../../context/AuthContext";
import { usePushNotification } from "../../../components/common/feedback/PushNotification";
import { listSchoolPrograms, createProgram } from "../../../../services/api/courseCreation";
import {
    EMPTY_COURSE_FORM,
    validateCourseForm,
} from "../../../../viewmodels/useCoursesViewModel";

// ── Jornadas disponibles ──────────────────────────────────

const JORNADA_ITEMS = [
    { value: "mañana", label: "Mañana", icon: "sunrise" },
    { value: "tarde", label: "Tarde", icon: "sun" },
    { value: "noche", label: "Noche", icon: "moon" },
    { value: "mixta", label: "Mixta", icon: "clock" },
];

// ── Estados disponibles ───────────────────────────────────

const STATUS_ITEMS = [
    { value: "active", label: "Activo", icon: "check-circle" },
    { value: "inactive", label: "Inactivo", icon: "x-circle" },
    { value: "completed", label: "Finalizado", icon: "archive" },
];

// ── Autogeneración de código de curso ─────────────────────
// Palabras vacías que no aportan a la sigla del curso.
const STOPWORDS = new Set([
    "de", "la", "el", "los", "las", "y", "o", "u", "en", "un", "una", "unos",
    "unas", "del", "al", "a", "i", "ii", "iii", "iv", "para", "con", "por",
]);

// Deriva un código único para el curso a partir de su nombre, dentro del
// programa seleccionado. Usa las iniciales de las primeras palabras
// significativas (p. ej. "Bases de Datos I" → "BDI") y, si ya existe en el
// programa, le agrega un correlativo ("BDI2", "BDI3", ...).
function generateCourseCode(name, existingCodes) {
    const words = String(name ?? "")
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .filter((w) => !STOPWORDS.has(w));
    let base = words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
    if (!base) return "";
    if (!/^[A-Z]/.test(base)) base = `C${base}`; // el código debe empezar con letra
    const taken = new Set((existingCodes || []).map((c) => String(c ?? "").trim().toUpperCase()));
    let code = base;
    let n = 2;
    while (taken.has(code)) {
        code = `${base}${n}`;
        n += 1;
    }
    return code;
}

// ── Componente principal ─────────────────────────────────

export default function RegisterCourseModal({ visible, onClose, onSubmit }) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const { t } = useTranslation();
    const c = theme.colors;
    const appData = useAppData();
    const pushNotification = usePushNotification();

    const [form, setForm] = useState(EMPTY_COURSE_FORM);
    const [saving, setSaving] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [success, setSuccess] = useState(false);
    const { user } = useAuth();

    // Programas de la sede (el backend exige program_id para crear el curso).
    const [schoolPrograms, setSchoolPrograms] = useState([]);
    const [programsError, setProgramsError] = useState(null);

    // Alta de programa en línea: una sede nueva no tiene ninguno y no hay
    // otra pantalla en la app para crearlos, así que sin esto el curso
    // queda inalcanzable (el dropdown de Programa aparece vacío siempre).
    const [showNewProgram, setShowNewProgram] = useState(false);
    const [newProgramName, setNewProgramName] = useState("");
    const [newProgramCode, setNewProgramCode] = useState("");
    const [savingProgram, setSavingProgram] = useState(false);
    const [newProgramError, setNewProgramError] = useState(null);

    const reloadPrograms = React.useCallback(() => {
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
    }, [user?.schoolId]);

    useEffect(() => {
        if (!visible) return;
        return reloadPrograms();
    }, [visible, reloadPrograms]);

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
            setSchoolPrograms((prev) => [...prev, created]);
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

    // Autogenerar el código del curso a partir del nombre y del programa.
    // El campo queda deshabilitado: el sistema asigna el código (único por
    // programa), y se recalcula solo si el nombre o el programa cambian.
    useEffect(() => {
        const name = String(form.name ?? "").trim();
        const programId = String(form.programId ?? "");
        if (!name || !programId) {
            setForm((prev) => (prev.code === "" ? prev : { ...prev, code: "" }));
            return;
        }
        const existing = (appData.courses || [])
            .filter((c) => String(c?.programId ?? "") === programId)
            .map((c) => c?.code);
        const generated = generateCourseCode(name, existing);
        setForm((prev) => (prev.code === generated ? prev : { ...prev, code: generated }));
    }, [form.name, form.programId, appData.courses]);

    // Programas disponibles de la sede (fuente: backend, con ID canónico).
    const programItems = schoolPrograms.map((p) => ({
        value: String(p.programId),
        label: p.code ? `${p.code} — ${p.name}` : p.name,
        icon: "book-open",
    }));

    // Instructores disponibles desde el contexto
    const instructorItems = appData.teachers.map((t) => ({
        value: t.name,
        label: t.name,
        icon: "user",
    }));

    // Ambientes disponibles desde el contexto (fuente de verdad real)
    const environmentItems = appData.environments.map((env) => ({
        value: env.id,
        label: `${env.number} — ${env.description.split('—')[0].trim()}`,
        icon: "map-pin",
    }));

    const setField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        // No necesitamos resetear errores aquí, las validaciones se manejan con push notifications
    };

    const handleClose = () => {
        setForm(EMPTY_COURSE_FORM);
        setShowErrors(false);
        setSuccess(false);
        setShowNewProgram(false);
        setNewProgramName("");
        setNewProgramCode("");
        setNewProgramError(null);
        onClose();
    };

    const handleSubmit = async () => {
        setShowErrors(true);

        // Validación — la función es importada estáticamente
        const validationErr = validateCourseForm(form);
        if (validationErr) {
            pushNotification.error(
                t("Error de validación"),
                t(validationErr)
            );
            return;
        }

        setSaving(true);
        const err = await onSubmit(form);
        setSaving(false);

        if (err) {
            pushNotification.error(
                t("Error al registrar curso"),
                t(err)
            );
        } else {
            setSuccess(true);
            pushNotification.success(
                t("¡Curso registrado!"),
                t("El curso ha sido registrado exitosamente")
            );
            setTimeout(() => {
                setForm(EMPTY_COURSE_FORM);
                setShowErrors(false);
                setSuccess(false);
                onClose();
            }, 900);
        }
    };

    const isEmpty = (v) => showErrors && !v.trim();

    if (!visible) return null;

    return (
        <BaseModal
            visible={visible}
            onClose={handleClose}
            title={t("Nuevo curso")}
            subtitle={t("Completa los datos del curso/ficha")}
            icon="book-open"
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
                                : t("Registrar curso")}
                    </Button>
                </React.Fragment>
            }
        >
            {/* Fila 1 — Nombre y Código */}
            <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 12 }}>
                <View style={{ flex: 1 }}>
                    <TextInput
                        label={t("Nombre del curso")}
                        value={form.name}
                        onChangeText={v => setField("name", v)}
                        placeholder={t("Análisis y Desarrollo de Software")}
                        error={isEmpty(form.name)}
                        errorMessage={isEmpty(form.name) ? t("Campo requerido") : ""}
                        leftIcon={<Feather name="book-open" size={16} color={c.text.tertiary} />}
                    />
                </View>
                <View style={{ width: isSmall ? "100%" : 160 }}>
                    <TextInput
                        label={t("Código") + " *"}
                        value={form.code}
                        onChangeText={v => setField("code", v)}
                        placeholder={t("Se genera automáticamente")}
                        disabled={true}
                        error={isEmpty(form.code)}
                        errorMessage={isEmpty(form.code) ? t("Selecciona nombre y programa") : ""}
                        leftIcon={<Feather name="hash" size={16} color={c.text.tertiary} />}
                        style={{ paddingRight: 8 }}
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

            {/* Programa (el backend lo exige para crear el curso) */}
            <View style={{ marginBottom: 2 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: (showErrors && !form.programId) || programsError ? c.status.error : c.text.secondary,
                    }}>
                        {t("Programa") + " *"}
                    </Text>
                    <TouchableOpacity
                        onPress={() => {
                            setNewProgramError(null);
                            setShowNewProgram((v) => !v);
                        }}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                    >
                        <Feather name="plus-circle" size={13} color={c.brand.primary} />
                        <Text style={{ fontSize: 12, fontWeight: "600", color: c.brand.primary }}>
                            {t("Nuevo programa")}
                        </Text>
                    </TouchableOpacity>
                </View>

                {showNewProgram ? (
                    <View style={{
                        borderWidth: 1,
                        borderColor: c.border.primary,
                        borderRadius: 14,
                        padding: 12,
                        gap: 10,
                        marginBottom: 10,
                    }}>
                        <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 10 : 8 }}>
                            <View style={{ flex: 1 }}>
                                <TextInput
                                    label={t("Nombre del programa")}
                                    value={newProgramName}
                                    onChangeText={setNewProgramName}
                                    placeholder={t("Ingeniería de Sistemas")}
                                    leftIcon={<Feather name="book" size={16} color={c.text.tertiary} />}
                                />
                            </View>
                            <View style={{ width: isSmall ? "100%" : 140 }}>
                                <TextInput
                                    label={t("Código")}
                                    value={newProgramCode}
                                    onChangeText={setNewProgramCode}
                                    placeholder={t("IS-2026")}
                                    leftIcon={<Feather name="hash" size={16} color={c.text.tertiary} />}
                                />
                            </View>
                        </View>
                        {newProgramError && (
                            <Text style={{ fontSize: 12, color: c.status.error }}>{newProgramError}</Text>
                        )}
                        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                            <Button variant="primary" size="sm" onPress={handleCreateProgram} disabled={savingProgram}>
                                {savingProgram
                                    ? <ActivityIndicator size="small" color={c.brand.textOnPrimary} />
                                    : t("Crear programa")}
                            </Button>
                        </View>
                    </View>
                ) : null}

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

            {/* Fila 2 — Jornada */}
            <View style={{ flex: 1 }}>
                <Text style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: showErrors && !form.schedule ? c.status.error : c.text.secondary,
                    marginBottom: 6,
                }}>
                    {t("Jornada")}
                </Text>
                <AnimatedDropdown
                    items={JORNADA_ITEMS.map(r => ({
                        value: r.value,
                        label: t(r.label),
                        icon: r.icon,
                    }))}
                    value={form.schedule}
                    onSelect={v => setField("schedule", v)}
                    triggerIcon="moon"
                    error={showErrors && !form.schedule}
                    triggerHeight={48}
                />
            </View>

        </BaseModal>
    );
}
