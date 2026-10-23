// ============================================================
//  FaceAttend EDU — JustificationTypesManager
//
//  CRUD de tipos de justificación (HU-CONF-008, FR 4.7).
//  Solo admin (canManageJustificationTypes): global (school_id NULL)
//  vs propio de sede, con requires_attachment (RN-33).
//  Tarjetas por tipo con filtro de alcance, sin listas con scroll interno.
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, Badge, Button, Card, ConfirmModal, EmptyState } from "../../components/common";
import { TextInput, Switch } from "../../components/common/inputs";
import { BaseModal } from "../../components/common/modals/BaseModal";
import { useTheme } from "../../components/hooks/useTheme";
import { useResponsive } from "../../components/hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../../../context/AuthContext";
import { attendanceApi } from "../../../services/api/attendanceApi";

const EMPTY_FORM = { name: "", description: "", requiresAttachment: false, global: false };

const needsSupport = (type) => !!(type?.requiresAttachment ?? type?.requires_attachment);
const isGlobal = (type) => (type?.schoolId ?? type?.school_id) == null;

export function JustificationTypesManager() {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const { user } = useAuth();
    const { isSmall } = useResponsive();

    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [busy, setBusy] = useState(false);
    const [filter, setFilter] = useState("all"); // all | global | school

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
        setForm(EMPTY_FORM);
        setFormError(null);
        setModalOpen(true);
    }

    function openEdit(type) {
        setEditing(type);
        setForm({
            name: type?.name ?? "",
            description: type?.description ?? "",
            requiresAttachment: needsSupport(type),
            global: isGlobal(type),
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

    const counts = {
        all: types.length,
        global: types.filter(isGlobal).length,
        school: types.filter((x) => !isGlobal(x)).length,
    };
    const shown = types.filter((x) =>
        filter === "all" ? true : filter === "global" ? isGlobal(x) : !isGlobal(x)
    );
    const withSupport = types.filter(needsSupport).length;

    return (
        <Card padding="lg">
            {/* Encabezado */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
                    <View
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: c.brand.primaryLight,
                        }}
                    >
                        <Feather name="tag" size={18} color={c.brand.primary} />
                    </View>
                    <View style={{ flexShrink: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: c.text.primary }}>
                            {t("Tipos de justificación")}
                        </Text>
                        <Text style={{ fontSize: 12, color: c.text.secondary }}>
                            {`${types.length} ${t("tipos")} · ${withSupport} ${t("requieren soporte")}`}
                        </Text>
                    </View>
                </View>
                <Button
                    variant="primary"
                    size="sm"
                    onPress={openCreate}
                    leftIcon={<Feather name="plus" size={14} color={c.brand.textOnPrimary} />}
                >
                    {t("Nuevo tipo")}
                </Button>
            </View>

            {/* Filtros por alcance */}
            {types.length > 0 && (
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {[
                        { key: "all", label: `${t("Todos")} (${counts.all})` },
                        { key: "global", label: `${t("Globales")} (${counts.global})` },
                        { key: "school", label: `${t("De la sede")} (${counts.school})` },
                    ].map((chip) => (
                        <Button
                            key={chip.key}
                            variant={filter === chip.key ? "secondary" : "ghost"}
                            size="sm"
                            onPress={() => setFilter(chip.key)}
                        >
                            {chip.label}
                        </Button>
                    ))}
                </View>
            )}

            {error && (
                <View style={{ marginBottom: 16 }}>
                    <Alert type="error" message={error} />
                </View>
            )}

            {loading ? (
                <View style={{ paddingVertical: 24, alignItems: "center" }}>
                    <ActivityIndicator color={c.brand.primary} />
                </View>
            ) : shown.length === 0 ? (
                <EmptyState
                    icon="tag"
                    title={types.length === 0 ? t("Sin tipos") : t("Sin tipos en este filtro")}
                    description={types.length === 0 ? t("Crea el primero") : t("Prueba con otro filtro")}
                />
            ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
                    {shown.map((type) => {
                        const id = type.justificationTypeId ?? type.id;
                        const global = isGlobal(type);
                        const req = needsSupport(type);
                        return (
                            <View
                                key={id}
                                style={{
                                    flexBasis: isSmall ? "100%" : "31%",
                                    flexGrow: 1,
                                    minWidth: 240,
                                    borderWidth: 1,
                                    borderColor: c.border.primary,
                                    borderRadius: 14,
                                    padding: 14,
                                    gap: 10,
                                    justifyContent: "space-between",
                                    backgroundColor: c.background.surface,
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                                    <View
                                        style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: 10,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backgroundColor: global ? c.status.infoLight : c.brand.primaryLight,
                                        }}
                                    >
                                        <Feather
                                            name={global ? "globe" : "home"}
                                            size={16}
                                            color={global ? c.status.info ?? c.brand.primary : c.brand.primary}
                                        />
                                    </View>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={{ fontSize: 14, fontWeight: "700", color: c.text.primary }} numberOfLines={2}>
                                            {type.name}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: c.text.secondary, marginTop: 2, minHeight: 32 }} numberOfLines={2}>
                                            {type.description || t("Sin descripción")}
                                        </Text>
                                    </View>
                                </View>

                                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                                    <Badge variant={global ? "info" : "default"} size="sm" icon={global ? "globe" : "home"}>
                                        {global ? t("Global") : t("Sede")}
                                    </Badge>
                                    <Badge variant={req ? "warning" : "success"} size="sm" icon={req ? "paperclip" : "check"}>
                                        {req ? t("Requiere soporte") : t("Sin soporte")}
                                    </Badge>
                                </View>

                                <View
                                    style={{
                                        flexDirection: "row",
                                        gap: 8,
                                        paddingTop: 10,
                                        borderTopWidth: 1,
                                        borderTopColor: c.border.primary,
                                    }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onPress={() => openEdit(type)}
                                            leftIcon={<Feather name="edit-2" size={13} color={c.text.primary} />}
                                        >
                                            {t("Editar")}
                                        </Button>
                                    </View>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onPress={() => setPendingDelete(type)}
                                        leftIcon={<Feather name="trash-2" size={14} color={c.status.danger} />}
                                    >
                                        {t("Eliminar")}
                                    </Button>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            <BaseModal
                visible={modalOpen}
                onClose={() => (saving ? null : setModalOpen(false))}
                title={editing ? t("Editar tipo") : t("Nuevo tipo")}
                subtitle={t("Define cuándo se puede justificar una inasistencia")}
                icon="tag"
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
                <View style={{ gap: 14 }}>
                    <TextInput
                        label={t("Nombre")}
                        required
                        value={form.name}
                        onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
                        placeholder={t("Calamidad doméstica")}
                        maxLength={100}
                    />
                    <TextInput
                        label={t("Descripción")}
                        value={form.description}
                        onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
                        placeholder={t("Cuándo aplica este tipo")}
                        maxLength={255}
                    />

                    <View style={{ gap: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: c.text.secondary }}>{t("Alcance")}</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                            {[
                                { key: false, icon: "home", title: t("De la sede"), hint: t("Solo tu sede") },
                                { key: true, icon: "globe", title: t("Global"), hint: t("Todas las sedes") },
                            ].map((opt) => {
                                const active = form.global === opt.key;
                                return (
                                    <TouchableOpacity
                                        key={String(opt.key)}
                                        onPress={() => setForm((p) => ({ ...p, global: opt.key }))}
                                        style={{
                                            flex: 1,
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 8,
                                            padding: 10,
                                            borderRadius: 12,
                                            borderWidth: 2,
                                            borderColor: active ? c.brand.primary : c.border.primary,
                                            backgroundColor: active ? c.brand.primaryLight : c.background.surface,
                                        }}
                                    >
                                        <Feather name={opt.icon} size={16} color={active ? c.brand.primary : c.text.secondary} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 13, fontWeight: "700", color: active ? c.brand.primary : c.text.primary }}>
                                                {opt.title}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: c.text.secondary }}>{opt.hint}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <Switch
                        label={t("Requiere soporte adjunto")}
                        value={form.requiresAttachment}
                        onValueChange={(v) => setForm((p) => ({ ...p, requiresAttachment: v }))}
                    />
                    <Text style={{ fontSize: 12, color: c.text.secondary, marginTop: -6 }}>
                        {t("Si está activo, la justificación no se puede aprobar sin al menos un documento de soporte.")}
                    </Text>
                </View>
            </BaseModal>

            <ConfirmModal
                visible={pendingDelete != null}
                onClose={() => (busy ? null : setPendingDelete(null))}
                onConfirm={confirmDelete}
                loading={busy}
                variant="danger"
                title={t("Eliminar tipo")}
                message={`${t("Se eliminará el tipo de justificación")} «${pendingDelete?.name ?? ""}». ${t("¿Continuar?")}`}
                confirmText={t("Eliminar")}
            />
        </Card>
    );
}

export default JustificationTypesManager;
