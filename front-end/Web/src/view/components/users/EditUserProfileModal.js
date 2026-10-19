// ============================================================
//  FaceAttend EDU — EditUserProfileModal
//  Modal para editar información del perfil de usuario
//  Permite editar nombre, correo y programa
// ============================================================

import React, { useState, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, AnimatedDropdown, TextInput } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useAppData } from "../../../context/AppDataContext";
import { usePushNotification } from "../common/feedback/PushNotification";
import { isValidEmail } from "../../../core/utils/validation";
import { titleCase, normalizeText } from "../../../core/utils/formatting";

// ── Funciones de formateo reutilizadas ─────────────────────

/**
 * Filtra el texto para permitir solo letras y espacios manteniendo acentos
 */
const filterLettersAndSpaces = (text) => {
    if (!text) return '';
    // Permite letras con acentos, espacios, ñ, ü, etc.
    return text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑç\s]/g, '');
};

/**
 * Formatea el nombre: filtra caracteres no válidos y capitaliza usando titleCase
 */
const formatName = (text) => {
    if (!text) return '';
    const filtered = filterLettersAndSpaces(text);
    return titleCase(filtered);
};

// ── Componente principal ─────────────────────────────────

export default function EditUserProfileModal({
    user,
    onClose,
    onSave,
    visible = true,
    closeOnBackdrop = false, // Por defecto no se cierra al hacer clic fuera
}) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const { courses, updateUser, updateStudent, forceRefresh } = useAppData();
    const pushNotification = usePushNotification();

    // Estados del formulario
    const [form, setForm] = useState({
        name: user?.name || "",
        email: user?.email || "",
        course: user?.course || "",
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [showErrors, setShowErrors] = useState(false);

    // Preparar items del dropdown de programas
    const programItems = useMemo(() => {
        if (!courses || courses.length === 0) return [];
        
        return courses
            .filter(course => course.status === "active")
            .map(course => ({
                value: course.code,
                label: course.name,
                description: `Ficha ${course.code}`,
                icon: "book-open",
            }));
    }, [courses]);

    // Validación del formulario
    const validateForm = useCallback(() => {
        const newErrors = {};

        // Validar nombre
        if (!form.name.trim()) {
            newErrors.name = t("El nombre es requerido");
        } else if (form.name.trim().length < 2) {
            newErrors.name = t("El nombre debe tener al menos 2 caracteres");
        }

        // Validar email
        if (!form.email.trim()) {
            newErrors.email = t("El correo es requerido");
        } else if (!isValidEmail(form.email.trim())) {
            newErrors.email = t("El formato del correo electrónico no es válido");
        }

        // Validar programa (solo para estudiantes y profesores)
        if (user?.userType !== "admin" && !form.course) {
            newErrors.course = t("El programa es requerido");
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [form, user?.userType, t]);

    // Manejo de cambios en el formulario
    const handleFieldChange = useCallback((field, value) => {
        setForm(prev => {
            const updated = { ...prev };
            
            // Formatear nombre automáticamente
            if (field === "name") {
                updated[field] = formatName(value);
            } else {
                updated[field] = value;
            }

            return updated;
        });

        // Limpiar errores cuando el usuario modifica el campo
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    }, [errors]);

    // Validación en tiempo real del email
    const handleEmailBlur = useCallback(() => {
        if (form.email.trim() && !isValidEmail(form.email.trim())) {
            setErrors(prev => ({ 
                ...prev, 
                email: t("El formato del correo electrónico no es válido") 
            }));
        }
    }, [form.email, t]);

    // Guardar cambios
    const handleSave = useCallback(async () => {
        setShowErrors(true);
        
        if (!validateForm()) {
            pushNotification.error(
                t("Error de validación"),
                t("Por favor corrige los errores en el formulario")
            );
            return;
        }

        setSaving(true);

        try {
            // Crear objeto con los datos actualizados
            const updatedData = {
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                ...(user?.userType !== "admin" && { course: form.course }),
            };

            console.log('Actualizando usuario:', user.id, 'con datos:', updatedData);

            // Actualizar según el tipo de usuario
            if (user?.userType === "student") {
                // Para estudiantes, usar updateStudent
                await updateStudent(user.id, updatedData);
            } else {
                // Para profesores y administradores, usar updateUser
                await updateUser(user.id, updatedData);
            }

            // Crear objeto de usuario actualizado para el callback
            const updatedUser = {
                ...user,
                ...updatedData,
            };

            console.log('Usuario actualizado exitosamente:', updatedUser);

            pushNotification.success(
                t("Usuario actualizado"),
                t("La información del perfil se ha actualizado correctamente")
            );

            // Llamar al callback del padre ANTES de cerrar para que la UI se actualice
            if (onSave) {
                await onSave(updatedUser);
            }

            // Forzar refresh del contexto como medida adicional
            if (forceRefresh) {
                setTimeout(() => {
                    forceRefresh();
                }, 200);
            }

            onClose();

        } catch (error) {
            console.error("Error al actualizar usuario:", error);
            pushNotification.error(
                t("Error"),
                t("No se pudo actualizar la información. Intenta nuevamente.")
            );
        } finally {
            setSaving(false);
        }
    }, [form, user, validateForm, updateUser, updateStudent, onSave, onClose, pushNotification, t]);

    if (!visible || !user) return null;

    return (
        <Modal transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity
                style={{
                    flex: 1,
                    backgroundColor: c.background.overlay,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 24,
                }}
                onPress={closeOnBackdrop ? onClose : undefined}
                activeOpacity={1}
                disabled={!closeOnBackdrop}
            >
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                    <View style={{
                        backgroundColor: c.background.surface,
                        borderRadius: 14,
                        width: 520,
                        maxHeight: "90%",
                        overflow: "hidden",
                        shadowColor: "#000",
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 8,
                    }}>
                        {/* Header */}
                        <View style={{
                            padding: 20,
                            borderBottomWidth: 1,
                            borderBottomColor: c.border.primary,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                <Feather name="edit-3" size={20} color={c.brand.primary} />
                                <Text style={{ fontSize: 18, fontWeight: "700", color: c.text.primary }}>
                                    {user.userType === "admin" ? t("Editar administrador") :
                                     user.userType === "teacher" ? t("Editar docente") :
                                     t("Editar estudiante")}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={onClose}>
                                <Feather name="x" size={18} color={c.text.secondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Body */}
                        <ScrollView style={{ maxHeight: 400 }}>
                            <View style={{ padding: 20, gap: 20 }}>
                                {/* Campo Nombre */}
                                <TextInput
                                    label={t("Nombre completo")}
                                    value={form.name}
                                    onChangeText={(text) => handleFieldChange("name", text)}
                                    placeholder={t("Ingresa el nombre completo")}
                                    required
                                    error={showErrors && !!errors.name}
                                    errorMessage={errors.name}
                                    leftIcon={<Feather name="user" size={16} color={c.text.secondary} />}
                                    type="text"
                                />

                                {/* Campo Email */}
                                <TextInput
                                    type="email"
                                    label={t("Correo electrónico")}
                                    value={form.email}
                                    onChangeText={(text) => handleFieldChange("email", text)}
                                    onBlur={handleEmailBlur}
                                    placeholder={t("correo@ejemplo.com")}
                                    required
                                    error={showErrors && !!errors.email}
                                    errorMessage={errors.email}
                                    leftIcon={<Feather name="mail" size={16} color={c.text.secondary} />}
                                />

                                {/* Campo Programa - Solo para estudiantes y profesores */}
                                {user?.userType !== "admin" && (
                                    <View>
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: "600",
                                            color: c.text.primary,
                                            marginBottom: 8,
                                        }}>
                                            {t("Programa")} *
                                        </Text>
                                        <AnimatedDropdown
                                            items={programItems}
                                            value={form.course}
                                            onSelect={(value) => handleFieldChange("course", value)}
                                            placeholder={t("Seleccionar programa")}
                                            triggerIcon="book-open"
                                            searchable
                                            searchPlaceholder={t("Buscar programa...")}
                                            error={errors.course && showErrors}
                                            triggerHeight={48}
                                            maxVisible={8}
                                        />
                                        {errors.course && showErrors && (
                                            <Text style={{
                                                fontSize: 12,
                                                color: c.status.error,
                                                marginTop: 4,
                                            }}>
                                                {errors.course}
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {/* Información adicional */}
                                <View style={{
                                    padding: 12,
                                    backgroundColor: c.background.app,
                                    borderRadius: 8,
                                    borderLeftWidth: 4,
                                    borderLeftColor: c.brand.primary,
                                }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                        <Feather name="info" size={14} color={c.brand.primary} />
                                        <Text style={{
                                            fontSize: 12,
                                            fontWeight: "600",
                                            color: c.text.primary,
                                        }}>
                                            {t("Información importante")}
                                        </Text>
                                    </View>
                                    <Text style={{
                                        fontSize: 11,
                                        color: c.text.secondary,
                                        lineHeight: 16,
                                    }}>
                                        • {t("El nombre se formateará automáticamente con mayúsculas iniciales")}{"\n"}
                                        • {t("El correo electrónico debe ser válido y único en el sistema")}{"\n"}
                                        {user?.userType !== "admin" && 
                                            `• ${t("El cambio de programa puede afectar la asistencia y horarios")}`
                                        }
                                    </Text>
                                </View>
                            </View>
                        </ScrollView>

                        {/* Footer */}
                        <View style={{
                            padding: 20,
                            borderTopWidth: 1,
                            borderTopColor: c.border.primary,
                            flexDirection: "row",
                            gap: 12,
                            justifyContent: "flex-end",
                        }}>
                            <Button
                                variant="ghost"
                                onPress={onClose}
                                disabled={saving}
                            >
                                {t("Cancelar")}
                            </Button>
                            <Button
                                variant="primary"
                                onPress={handleSave}
                                loading={saving}
                                disabled={saving}
                            >
                                {saving ? t("Guardando...") : t("Guardar cambios")}
                            </Button>
                        </View>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}