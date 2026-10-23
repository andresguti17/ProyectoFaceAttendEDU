// ============================================================
//  FaceAttend EDU — EditUserModal
//  Edición de datos básicos de cualquier usuario (estudiante,
//  docente o administrador): nombre, documento, correo, teléfono,
//  usuario y estado. La contraseña no se edita aquí.
//  La validación vive en el ViewModel; el guardado real es
//  PUT /persons/{id} + PUT /users/{id} (+ PATCH status).
// ============================================================

import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, AnimatedDropdown, BaseModal, TextInput } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useResponsive } from "../hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { academicApi } from "../../../services/api/academicApi";

const ROLE_TITLES = {
    student: "Editar estudiante",
    teacher: "Editar docente",
    admin: "Editar administrador",
};

export default function EditUserModal({ visible, onClose, onSubmit, user, canChangeRole }) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const { t } = useTranslation();
    const c = theme.colors;

    const [form, setForm] = useState(null);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [schoolName, setSchoolName] = useState("");

    // Cargar datos al abrir (una sola vez por apertura).
    React.useEffect(() => {
        if (visible && user) {
            const parts = String(user.name ?? "").trim().split(/\s+/).filter(Boolean);
            setForm({
                name: parts[0] ?? "",
                lastName: parts.slice(1).join(" "),
                documentNumber: user.documentNumber ?? user.document ?? "",
                documentType: user.documentType ?? "",
                bloodType: user.bloodType ?? "",
                birthDate: user.birthDate ? String(user.birthDate).slice(0, 10) : "",
                address: user.address ?? "",
                email: user.email ?? "",
                phone: user.telefono ?? user.phone ?? "",
                username: user.username ?? "",
                status: user.status ?? "active",
                role: user.userType ?? "student",
            });
            setError(null);
            setShowErrors(false);
            setSaving(false);
        }
    }, [visible, user]);

    // El backend no expone PATCH sobre academic_actor, así que Sede y Código se
    // muestran solo lectura; aquí se resuelve el nombre de la sede para mostrarlo.
    React.useEffect(() => {
        if (!visible || !user?.schoolId) {
            setSchoolName("");
            return;
        }
        let cancelled = false;
        academicApi.listSchools().then(
            (schools) => {
                if (cancelled) return;
                const rows = Array.isArray(schools) ? schools : schools?.content ?? [];
                const found = rows
                    .find((s) => String(s?.schoolId) === String(user.schoolId));
                setSchoolName(found?.name ?? "");
            },
            () => {}
        );
        return () => { cancelled = true; };
    }, [visible, user?.schoolId]);

    if (!visible) return null;

    const setField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        if (showErrors) setError(null);
    };

    const handleClose = () => {
        setForm(null);
        setError(null);
        setShowErrors(false);
        setSaving(false);
        onClose();
    };

    const handleSubmit = async () => {
        setShowErrors(true);
        setError(null);
        setSaving(true);
        const err = await onSubmit(form);
        setSaving(false);
        if (err) {
            setError(err);
        } else {
            onClose();
        }
    };

    const isEmpty = (v) => showErrors && !String(v ?? "").trim();
    const title = ROLE_TITLES[user?.userType] || t("Editar usuario");

    return (
        <BaseModal
            visible={visible}
            onClose={handleClose}
            title={t(title)}
            subtitle={user?.email || ""}
            icon="edit"
            maxWidth={520}
            footer={
                <React.Fragment>
                    <Button variant="ghost" onPress={handleClose} disabled={saving}>
                        {t("Cancelar")}
                    </Button>
                    <Button variant="primary" onPress={handleSubmit} disabled={saving}>
                        {saving
                            ? <ActivityIndicator size="small" color={c.brand.textOnPrimary} />
                            : t("Guardar cambios")}
                    </Button>
                </React.Fragment>
            }
        >
            {error && (
                <View style={{
                    backgroundColor: c.status.dangerLight,
                    borderRadius: 14,
                    padding: 12,
                    flexDirection: "row",
                    gap: 8,
                    marginBottom: 14,
                }}>
                    <Text style={{ fontSize: 11, color: c.status.danger, flex: 1 }}>{error}</Text>
                </View>
            )}

            <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 12 }}>
                <View style={{ flex: 1 }}>
                    <TextInput
                        label={t("Nombre") + " *"}
                        value={form?.name ?? ""}
                        onChangeText={v => setField("name", v)}
                        error={isEmpty(form?.name)}
                        errorMessage={isEmpty(form?.name) ? t("Campo requerido") : ""}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <TextInput
                        label={t("Apellido") + " *"}
                        value={form?.lastName ?? ""}
                        onChangeText={v => setField("lastName", v)}
                        error={isEmpty(form?.lastName)}
                        errorMessage={isEmpty(form?.lastName) ? t("Campo requerido") : ""}
                    />
                </View>
            </View>

            <TextInput
                label={t("Número de documento") + " *"}
                value={form?.documentNumber ?? ""}
                onChangeText={v => setField("documentNumber", v)}
                error={isEmpty(form?.documentNumber)}
                errorMessage={isEmpty(form?.documentNumber) ? t("Campo requerido") : ""}
            />

            <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 12 }}>
                <View style={{ flex: 1, marginBottom: 2 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: c.text.secondary, marginBottom: 6 }}>
                        {t("Tipo de documento")}
                    </Text>
                    <AnimatedDropdown
                        items={["CC", "TI", "CE", "PP"].map((d) => ({ value: d, label: d, icon: "credit-card" }))}
                        value={form?.documentType ?? ""}
                        onSelect={v => setField("documentType", v)}
                        placeholder={t("Seleccionar tipo")}
                        triggerHeight={48}
                    />
                </View>
                <View style={{ flex: 1, marginBottom: 2 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: c.text.secondary, marginBottom: 6 }}>
                        {t("Tipo de sangre")}
                    </Text>
                    <AnimatedDropdown
                        items={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => ({ value: b, label: b, icon: "droplet" }))}
                        value={form?.bloodType ?? ""}
                        onSelect={v => setField("bloodType", v)}
                        placeholder={t("Seleccionar tipo")}
                        triggerHeight={48}
                    />
                </View>
            </View>

            <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 12 }}>
                <View style={{ flex: 1 }}>
                    <TextInput
                        label={t("Nacimiento (AAAA-MM-DD)")}
                        value={form?.birthDate ?? ""}
                        onChangeText={v => setField("birthDate", v)}
                        placeholder={t("Ej: 2005-03-14")}
                        error={showErrors && !!String(form?.birthDate ?? "").trim() && !/^\d{4}-\d{2}-\d{2}$/.test(String(form?.birthDate).trim())}
                        errorMessage={t("Formato AAAA-MM-DD")}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <TextInput
                        label={t("Dirección")}
                        value={form?.address ?? ""}
                        onChangeText={v => setField("address", v)}
                        placeholder={t("Ej: Calle 10 # 5-20")}
                    />
                </View>
            </View>

            <TextInput
                label={t("Correo electrónico") + " *"}
                value={form?.email ?? ""}
                onChangeText={v => setField("email", v)}
                type="email"
                error={isEmpty(form?.email)}
                errorMessage={isEmpty(form?.email) ? t("Campo requerido") : ""}
            />

            <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 12 }}>
                <View style={{ flex: 1 }}>
                    <TextInput
                        label={t("Teléfono")}
                        type="phone"
                        value={form?.phone ?? ""}
                        onChangeText={v => setField("phone", v)}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <TextInput
                        label={t("Usuario") + " *"}
                        value={form?.username ?? ""}
                        onChangeText={v => setField("username", v)}
                        error={isEmpty(form?.username)}
                        errorMessage={isEmpty(form?.username) ? t("Campo requerido") : ""}
                    />
                </View>
            </View>

            {/* Vínculo académico (solo lectura): el backend no expone PATCH sobre
                academic_actor, así que código/sede/ficha se muestran, no se editan. */}
            <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: c.text.secondary, marginBottom: 6 }}>
                    {t("Vínculo académico")}
                </Text>
                <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 12 }}>
                    {[
                        // En estudiantes `code` ya es el código del actor (en el resto es el username).
                        { label: t("Código"), value: user?.actorCode || (user?.userType === "student" ? user?.code : "") || "—", icon: "hash" },
                        { label: t("Sede"), value: schoolName || "—", icon: "map-pin" },
                        { label: t("Ficha/Curso asignado"), value: user?.course || user?.ficha || "—", icon: "book-open" },
                    ].map((f) => (
                        <View key={f.label} style={{ flex: 1, marginBottom: isSmall ? 10 : 0 }}>
                            <Text style={{ fontSize: 12, color: c.text.tertiary, marginBottom: 4 }}>
                                {f.label}
                            </Text>
                            <View style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                                borderWidth: 1,
                                borderColor: c.border.primary,
                                borderRadius: 14,
                                paddingHorizontal: 12,
                                minHeight: 48,
                                backgroundColor: c.background.app,
                            }}>
                                <Feather name={f.icon} size={16} color={c.text.tertiary} />
                                <Text style={{ fontSize: 14, color: c.text.primary, flex: 1 }} numberOfLines={1}>
                                    {f.value}
                                </Text>
                                <Feather name="lock" size={14} color={c.text.tertiary} />
                            </View>
                        </View>
                    ))}
                </View>
                <Text style={{ fontSize: 12, color: c.text.tertiary, marginTop: 2 }}>
                    {t("Se gestiona al crear el usuario; no es editable aquí.")}
                </Text>
            </View>

            <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: c.text.secondary, marginBottom: 6 }}>
                    {t("Estado")}
                </Text>                <View style={{ flexDirection: "row", gap: 8 }}>
                    {[
                        { value: "active", label: t("Activo") },
                        { value: "inactive", label: t("Inactivo") },
                    ].map((s) => (
                        <TouchableOpacity
                            key={s.value}
                            onPress={() => setField("status", s.value)}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                                paddingVertical: 10,
                                paddingHorizontal: 14,
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: form?.status === s.value
                                    ? c.brand.primary
                                    : c.border.primary,
                                backgroundColor: form?.status === s.value
                                    ? c.brand.primaryLight
                                    : c.background.app,
                            }}
                        >
                            <Text style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: form?.status === s.value
                                    ? c.brand.primary
                                    : c.text.secondary,
                            }}>
                                {s.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {canChangeRole && (
                <View style={{ marginBottom: 4, marginTop: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: c.text.secondary, marginBottom: 6 }}>
                        {t("Rol (solo Super Admin)")}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        {[
                            { value: "student", label: t("Estudiante") },
                            { value: "teacher", label: t("Docente") },
                            { value: "admin", label: t("Administrador") },
                            { value: "superadmin", label: t("Super Administrador") },
                        ].map((s) => (
                            <TouchableOpacity
                                key={s.value}
                                onPress={() => setField("role", s.value)}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                    paddingVertical: 10,
                                    paddingHorizontal: 14,
                                    borderRadius: 14,
                                    borderWidth: 1.5,
                                    borderColor: form?.role === s.value
                                        ? c.brand.primary
                                        : c.border.primary,
                                    backgroundColor: form?.role === s.value
                                        ? c.brand.primaryLight
                                        : c.background.app,
                                }}
                            >
                                <Text style={{
                                    fontSize: 13,
                                    fontWeight: "600",
                                    color: form?.role === s.value
                                        ? c.brand.primary
                                        : c.text.secondary,
                                }}>
                                    {s.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
        </BaseModal>
    );
}
