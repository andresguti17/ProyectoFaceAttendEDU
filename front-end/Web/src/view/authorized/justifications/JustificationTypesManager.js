// ============================================================
//  FaceAttend EDU — JustificationTypesManager
//
//  CRUD de tipos de justificación (HU-CONF-008, FR 4.7).
//  Solo admin (canManageJustificationTypes): global (school_id NULL)
//  vs propio de sede, con requires_attachment (RN-33).
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, Badge, Button, Card, ConfirmModal, EmptyState } from "../../components/common";
import { TextInput, Switch } from "../../components/common/inputs";
import { BaseModal } from "../../components/common/modals/BaseModal";
import { useTheme } from "../../components/hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../../../context/AuthContext";
import { attendanceApi } from "../../../services/api/attendanceApi";

export function JustificationTypesManager() {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const { user } = useAuth();

    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: "", description: "", requiresAttachment: false, global: false });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await attendanceApi.listJustificationTypes();
            setTypes(Array.isArray(list) ? list : list?.data ?? []);
        } catch (e) {
            setError(e?.message || t("No se pudieron cargar los tipos."));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    function openCreate() {
        setEditing(null);
        setForm({ name: "", description: "", requiresAttachment: false, global: false });
        setFormError(null);
        setModalOpen(true);
    }

    function openEdit(type) {
        setEditing(type);
        setForm({
            name: type?.name ?? "",
            description: type?.description ?? "",
            requiresAttachment: !!(type?.requiresAttachment ?? type?.requires_attachment),
            global: (type?.schoolId ?? type?.school_id) == null,
        });
        setFormError(null);
        setModalOpen(true);
    }

    async function save() {
        if (!form.name.trim()) {
            setFormError(t("El nombre es requerido"));
            return;
        }
        setSaving(true);
        setFormError(null);
        const body = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            requiresAttachment: !!form.requiresAttachment,
            schoolId: form.global ? null : user?.schoolId ?? null,
        };
        try {
            if (editing) {
                const id = editing.justificationTypeId ?? editing.id;
                await attendanceApi.updateJustificationType(id, body);
            } else {
                await attendanceApi.createJustificationType(body);
            }
        } catch (e) {
            setSaving(false);
            setFormError(e?.message || t("No se pudo guardar el tipo."));
            return;
        }
        setSaving(false);
        setModalOpen(false);
        load();
    }

    async function confirmDelete() {
        if (!pendingDelete) return;
        setBusy(true);
        try {
            const id = pendingDelete.justificationTypeId ?? pendingDelete.id;
            await attendanceApi.deleteJustificationType(id);
            setPendingDelete(null);
            load();
        } catch (e) {
            setError(e?.message || t("No se pudo eliminar el tipo."));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card padding="lg" style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: c.text.primary }}>
                    {t("Tipos de justificación")}
                </Text>
                <Button
                    variant="primary"
                    size="sm"
                    onPress={openCreate}
                    leftIcon={<Feather name="plus" size={14} color={c.brand.textOnPrimary} />}
                >
                    {t("Nuevo tipo")}
                </Button>
            </View>

            {error && <Alert type="error" message={error} />}
            {loading ? (
                <Text style={{ color: c.text.secondary }}>{t("Cargando...")}</Text>
            ) : types.length === 0 ? (
                <EmptyState icon="file-text" title={t("Sin tipos")} description={t("Crea el primero")} />
            ) : (
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                    {types.map((type) => {
                        const id = type.justificationTypeId ?? type.id;
                        const global = (type.schoolId ?? type.school_id) == null;
                        const req = !!(type.requiresAttachment ?? type.requires_attachment);
                        return (
                            <View
                                key={id}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                    paddingVertical: 8,
                                    borderBottomWidth: 1,
                                    borderBottomColor: c.border.primary,
                                }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "600", color: c.text.primary }}>{type.name}</Text>
                                    <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                                        <Badge variant={global ? "info" : "default"} size="sm">
                                            {global ? t("Global") : t("Sede")}
                                        </Badge>
                                        {req && (
                                            <Badge variant="warning" size="sm">
                                                {t("Requiere soporte")}
                                            </Badge>
                                        )}
                                    </View>
                                </View>
                                <Button variant="outline" size="sm" onPress={() => openEdit(type)}>
                                    {t("Editar")}
                                </Button>
                                <Button variant="danger" size="sm" onPress={() => setPendingDelete(type)}>
                                    {t("Eliminar")}
                                </Button>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            <BaseModal
                visible={modalOpen}
                onClose={() => (saving ? null : setModalOpen(false))}
                title={editing ? t("Editar tipo") : t("Nuevo tipo")}
                icon="file-text"
                iconColor={c.brand.primary}
                size="sm"
                footer={
                    <>
                        <Button variant="outline" onPress={() => setModalOpen(false)} disabled={saving}>
                            {t("Cancelar")}
                        </Button>
                        <Button variant="primary" onPress={save} loading={saving}>
                            {t("Guardar")}
                        </Button>
                    </>
                }
            >
                {formError && (
                    <View style={{ marginBottom: 12 }}>
                        <Alert type="error" message={formError} />
                    </View>
                )}
                <View style={{ gap: 12 }}>
                    <TextInput
                        label={t("Nombre")}
                        required
                        value={form.name}
                        onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
                        placeholder={t("Calamidad doméstica")}
                    />
                    <TextInput
                        label={t("Descripción")}
                        value={form.description}
                        onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
                    />
                    <Switch
                        label={t("Requiere soporte adjunto (RN-33)")}
                        value={form.requiresAttachment}
                        onValueChange={(v) => setForm((p) => ({ ...p, requiresAttachment: v }))}
                    />
                    <Switch
                        label={t("Tipo global (todas las sedes)")}
                        value={form.global}
                        onValueChange={(v) => setForm((p) => ({ ...p, global: v }))}
                    />
                </View>
            </BaseModal>

            <ConfirmModal
                visible={pendingDelete != null}
                onClose={() => (busy ? null : setPendingDelete(null))}
                onConfirm={confirmDelete}
                loading={busy}
                variant="danger"
                title={t("Eliminar tipo")}
                message={t("Se eliminará el tipo de justificación. ¿Continuar?")}
                confirmText={t("Eliminar")}
            />
        </Card>
    );
}

export default JustificationTypesManager;
