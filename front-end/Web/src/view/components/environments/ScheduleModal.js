// ============================================================
//  FaceAttend EDU — ScheduleModal
//  Modal para agregar/editar horarios en ambientes
// ============================================================

import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, BaseModal, AnimatedDropdown } from "../common";
import TextInput from "../common/inputs/TextInput";
import TimeInput from "../common/inputs/TimeInput";
import { useDateFormat } from "../hooks/useDateFormat";
import { useTheme } from "../hooks/useTheme";
import { useResponsive } from "../hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { usePushNotification } from "../common/feedback/PushNotification";
import { useAppData } from "../../../context/AppDataContext";
import { getInstitutionConfig } from "../../../core/config/institutionConfig";
import InstructorAutocomplete from "./InstructorAutocomplete";
import {
    EMPTY_SCHEDULE_FORM,
    WEEK_DAYS,
    getTimePlaceholders,
} from "../../../viewmodels/useEnvironmentsViewModel";

export default function ScheduleModal({
    visible,
    mode, // "add" | "edit"
    editing,
    envId,
    searchFn,
    onClose,
    onSave,
    getCurrentEnvironment, // Nueva prop
    getCourseByCode,       // Nueva prop
    getCohortsForCourse,   // Fichas del programa del curso (backend)
}) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const { t } = useTranslation();
    const pushNotification = usePushNotification();
    const c = theme.colors;
    const appData = useAppData();
    const { timeFormat24h } = useDateFormat();

    const [form, setForm] = useState(EMPTY_SCHEDULE_FORM);
    const [saving, setSaving] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [courseNameInput, setCourseNameInput] = useState(""); // Para búsqueda bidireccional
    const [dropdownOpen, setDropdownOpen] = useState(false); // Controlar apertura del dropdown
    const [cohortOptions, setCohortOptions] = useState([]); // Fichas del curso (backend)

    // Fichas vigentes del programa del curso: si hay una sola se
    // autoselecciona; si hay varias el usuario elige.
    useEffect(() => {
        if (!visible || !form.courseCode || !getCohortsForCourse) {
            setCohortOptions([]);
            return;
        }
        let cancelled = false;
        getCohortsForCourse(form.courseCode).then(
            (list) => {
                if (cancelled) return;
                setCohortOptions(Array.isArray(list) ? list : []);
                if (Array.isArray(list) && list.length === 1) {
                    setForm((prev) => ({ ...prev, cohortId: String(list[0].cohortId) }));
                }
            },
            () => {
                if (!cancelled) setCohortOptions([]);
            }
        );
        return () => {
            cancelled = true;
        };
    }, [visible, form.courseCode, getCohortsForCourse]);

    // Obtener curso seleccionado y calcular placeholders dinámicos
    const selectedCourse = useMemo(() => {
        if (!form.courseCode) return null;
        return getCourseByCode?.(form.courseCode) || null;
    }, [form.courseCode, getCourseByCode]);

    // Calcular placeholders dinámicos basados en jornada y horarios existentes
    const timePlaceholders = useMemo(() => {
        const is24Hour = timeFormat24h;
        const environment = getCurrentEnvironment?.();
        const existingSchedules = environment?.schedules || [];
        const shift = selectedCourse?.schedule || "mañana";
        
        return getTimePlaceholders(shift, existingSchedules, form.days, is24Hour);
    }, [selectedCourse, form.days, getCurrentEnvironment, timeFormat24h]);

    // Generar items de fichas desde los cursos disponibles
    const fichaItems = useMemo(() => {
        if (!appData.courses || appData.courses.length === 0) return [];
        
        return appData.courses
            .filter(course => course.status === "active")
            .map(course => ({
                value: course.code,
                label: course.name,
                description: `Ficha ${course.code}`,
                icon: "book-open",
            }));
    }, [appData.courses]);

    // Filtrar fichas según el input de "Nombre del programa" (búsqueda bidireccional)
    const filteredFichaItems = useMemo(() => {
        if (!courseNameInput.trim()) return fichaItems.slice(0, 5); // Máximo 5 por defecto
        
        const query = courseNameInput.toLowerCase();
        return fichaItems
            .filter(item => 
                item.label.toLowerCase().includes(query) ||
                item.value.toLowerCase().includes(query)
            )
            .slice(0, 5); // Máximo 5 resultados
    }, [fichaItems, courseNameInput]);

    useEffect(() => {
        if (visible && editing) {
            setForm({
                courseCode: editing.courseCode,
                courseName: editing.courseName,
                cohortId: editing.cohortId ?? "",
                instructorQuery: editing.instructorName,
                instructorId: editing.instructor,
                instructorName: editing.instructorName,
                startTime: editing.startTime,
                endTime: editing.endTime,
                days: [...editing.days],
            });
            setCourseNameInput(editing.courseName); // Sincronizar input de nombre
        } else if (visible) {
            setForm(EMPTY_SCHEDULE_FORM);
            setCourseNameInput(""); // Limpiar input de nombre
        }
        setCohortOptions([]);
        setShowErrors(false);
        setSaving(false);
    }, [visible, editing]);

    const setField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        // No necesitamos limpiar error aquí ya que usamos push notifications
    };

    // Handler para cuando se selecciona una ficha del dropdown
    const handleFichaSelect = (fichaCode) => {
        const selectedFicha = appData.courses.find(c => c.code === fichaCode);
        if (selectedFicha) {
            setForm(prev => ({
                ...prev,
                courseCode: selectedFicha.code,
                courseName: selectedFicha.name,
            }));
            setCourseNameInput(selectedFicha.name); // Sincronizar input
        }
        setDropdownOpen(false); // Cerrar dropdown al seleccionar
        // No necesitamos limpiar error aquí ya que usamos push notifications
    };

    // Handler para cuando se escribe en "Nombre del programa"
    const handleCourseNameChange = (value) => {
        setCourseNameInput(value); // Actualizar búsqueda para filtrar dropdown
        setForm(prev => ({
            ...prev,
            courseName: value,
        }));
        
        // Abrir dropdown cuando se escribe (mínimo 1 carácter)
        if (value.trim().length > 0) {
            setDropdownOpen(true);
        } else {
            setDropdownOpen(false);
        }
        
        // No necesitamos limpiar error aquí ya que usamos push notifications
    };

    const toggleDay = (day) => {
        const newDays = form.days.includes(day)
            ? form.days.filter((d) => d !== day)
            : [...form.days, day];
        
        setField("days", newDays);
    };

    const handleSave = async () => {
        setShowErrors(true);
        setSaving(true);
        
        const config = getInstitutionConfig();
        const err = await onSave(form);
        setSaving(false);
        
        if (err) {
            // Mostrar diferentes tipos de notificación según el tipo de error
            const isConflictError = err.includes("Conflicto de horarios") || err.includes("conflicto");
            const isCapacityError = err.includes("capacidad") || err.includes("excede");
            const isValidationError = err.includes("Completa todos los campos") || err.includes("requerido");
            const isFormatError = err.includes("Formato de hora");
            
            if (config.pushNotifications) {
                if (isConflictError) {
                    pushNotification.warning(
                        t("Conflicto de horarios"),
                        t(err),
                        {
                            source: "schedule-form",
                            priority: "high",
                            duration: 8000, // Más tiempo para leer el conflicto
                        }
                    );
                } else if (isCapacityError) {
                    pushNotification.warning(
                        t("Problema de capacidad"),
                        t(err),
                        {
                            source: "schedule-form",
                            priority: "high",
                            duration: 6000,
                        }
                    );
                } else if (isValidationError) {
                    pushNotification.error(
                        t("Campos requeridos"),
                        t(err),
                        {
                            source: "schedule-form",
                            priority: "normal",
                            duration: 4000,
                        }
                    );
                } else if (isFormatError) {
                    pushNotification.error(
                        t("Formato incorrecto"),
                        t(err),
                        {
                            source: "schedule-form",
                            priority: "normal",
                            duration: 5000,
                        }
                    );
                } else {
                    // Error genérico
                    pushNotification.error(
                        t("Error de validación"),
                        t(err),
                        {
                            source: "schedule-form",
                            priority: "high",
                            duration: 6000,
                        }
                    );
                }
            }
        } else {
            // Mostrar notificación de éxito
            if (config.pushNotifications) {
                pushNotification.success(
                    t("¡Horario guardado!"),
                    mode === "add" 
                        ? t("Horario asignado correctamente") 
                        : t("Horario actualizado correctamente"),
                    {
                        source: "schedule-form",
                        priority: "normal",
                        duration: 3000,
                    }
                );
            }
            onClose();
        }
    };

    const isEmpty = (v) => showErrors && !v.trim();

    const footer = (
        <>
            <Button variant="ghost" size="md" onPress={onClose} disabled={saving}>
                {t("Cancelar")}
            </Button>
            <Button
                variant="primary"
                size="md"
                onPress={handleSave}
                disabled={saving}
                leftIcon={
                    saving ? (
                        <ActivityIndicator size="small" color={c.interactive.disabledText} />
                    ) : (
                        <Feather name="check" size={16} color={c.brand.textOnPrimary} />
                    )
                }
            >
                {saving ? t("Guardando...") : t("Guardar horario")}
            </Button>
        </>
    );

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title={mode === "add" ? t("Nuevo horario") : t("Editar horario")}
            subtitle={t("Asignación de ficha e instructor")}
            icon="clock"
            iconColor={c.brand.primary}
            size="md"
            footer={footer}
        >
            <View style={{ marginBottom: 14, position: 'relative', zIndex: 10 }}>
                <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 14, marginBottom: isSmall ? 0 : 14 }}>
                    <View style={{ flex: 1, minWidth: 160, zIndex: 10 }}>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: showErrors && !form.courseCode ? c.status.danger : c.text.secondary,
                            marginBottom: 6,
                        }}>
                            {t("Nº Ficha / Código")} *
                        </Text>
                        <AnimatedDropdown
                            items={filteredFichaItems}
                            value={form.courseCode}
                            onSelect={handleFichaSelect}
                            placeholder={t("Ej: 2240001")}
                            searchable={true}
                            searchPlaceholder={t("Buscar ficha...")}
                            maxVisible={5}
                            triggerIcon="book-open"
                            error={showErrors && !form.courseCode}
                            triggerHeight={48}
                            controlledOpen={courseNameInput.trim().length > 0 ? dropdownOpen : undefined}
                            onOpenChange={setDropdownOpen}
                        />
                    </View>
                    <View style={{ flex: 2, minWidth: 200, zIndex: 1 }}>
                        <TextInput
                            label={t("Nombre del programa") + " *"}
                            value={courseNameInput}
                            onChangeText={handleCourseNameChange}
                            placeholder={t("Ej: Tecnología en Sistemas")}
                            error={isEmpty(form.courseName)}
                            helperText={form.courseCode ? t("Vinculado a ficha ") + form.courseCode : ""}
                        />
                    </View>
                </View>
            </View>

            {/* Instructor autocomplete */}
            <View style={{ marginBottom: 8, position: 'relative', zIndex: 5 }}>
                <InstructorAutocomplete
                    instructorId={form.instructorId}
                    onSelect={(u) => {
                        setField("instructorId", u.id);
                        setField("instructorName", u.name);
                        setField("instructorQuery", u.name);
                    }}
                    searchFn={searchFn}
                    error={showErrors && !form.instructorId}
                />
            </View>

            {/* Ficha (solo si el curso tiene varias vigentes en el backend) */}
            {cohortOptions.length > 1 && (
                <View style={{ marginBottom: 8, position: 'relative', zIndex: 4 }}>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: showErrors && !form.cohortId ? c.status.error : c.text.secondary,
                        marginBottom: 6,
                    }}>
                        {t("Ficha") + " *"}
                    </Text>
                    <AnimatedDropdown
                        items={cohortOptions.map((cohort) => ({
                            value: String(cohort.cohortId),
                            label: cohort.code || String(cohort.cohortId),
                            icon: "users",
                        }))}
                        value={form.cohortId}
                        onSelect={(v) => setField("cohortId", v)}
                        placeholder={t("Seleccionar ficha")}
                        triggerIcon="users"
                        error={showErrors && !form.cohortId}
                        triggerHeight={48}
                    />
                </View>
            )}

            {/* Time range */}
            <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 14, marginBottom: 14, position: 'relative', zIndex: 1 }}>
                <View style={{ flex: 1 }}>
                    <TimeInput
                        label={t("Hora inicio") + " *"}
                        value={form.startTime}
                        onChangeText={(v) => setField("startTime", v)}
                        placeholder={timePlaceholders.startPlaceholder}
                        error={isEmpty(form.startTime)}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <TimeInput
                        label={t("Hora fin") + " *"}
                        value={form.endTime}
                        onChangeText={(v) => setField("endTime", v)}
                        placeholder={timePlaceholders.endPlaceholder}
                        error={isEmpty(form.endTime)}
                    />
                </View>
            </View>

            {/* Days selector */}
            <View style={{ marginBottom: 14, position: 'relative', zIndex: 1 }}>
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: showErrors && form.days.length === 0 ? c.status.danger : c.text.secondary,
                        marginBottom: 10,
                    }}
                >
                    {t("Días de clase")} *
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {WEEK_DAYS.map((day) => {
                        const active = form.days.includes(day);
                        return (
                            <TouchableOpacity
                                key={day}
                                onPress={() => toggleDay(day)}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 8,
                                    borderWidth: 2,
                                    borderColor: active ? c.brand.primary : c.border.primary,
                                    backgroundColor: active ? c.brand.primaryLight : c.background.app,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: active ? c.brand.primary : c.text.secondary,
                                    }}
                                >
                                    {t(day)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </BaseModal>
    );
}
