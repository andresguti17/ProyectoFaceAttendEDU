// ============================================================
//  FaceAttend EDU — RolesManager
//
//  Matriz rol x permiso (HU-IAM-003, FR 1.1.2). Solo Super Admin
//  (canManageRoles). Asignar/quitar permisos por rol + CRUD de roles.
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, Badge, Button, Card, ConfirmModal, EmptyState } from "../../components/common";
import { TextInput } from "../../components/common/inputs";
import { Checkbox } from "../../components/common/inputs/Checkbox";
import { BaseModal } from "../../components/common/modals/BaseModal";
import { useTheme } from "../../components/hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { authorizationApi } from "../../../services/api/authorizationApi";

function roleIdOf(role) {
    return role?.roleId ?? role?.role_id ?? role?.id;
}

function permIdOf(perm) {
    return perm?.permissionId ?? perm?.permission_id ?? perm?.id;
}

function permNameOf(perm) {
    return perm?.permissionName ?? perm?.permission_name ?? perm?.name ?? "";
}

export function RolesManager() {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [matrix, setMatrix] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [busyKey, setBusyKey] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ roleName: "", description: "" });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [roleList, permList] = await Promise.all([
                authorizationApi.listRoles(),
                authorizationApi.listPermissions(),
            ]);
            const rList = Array.isArray(roleList) ? roleList : roleList?.data ?? [];
            const pList = Array.isArray(permList) ? permList : permList?.data ?? [];
            setRoles(rList);
            setPermissions(pList);
            const entries = await Promise.all(
                rList.map(async (role) => {
                    const id = roleIdOf(role);
                    try {
                        const perms = await authorizationApi.rolePermissions(id);
                        const list = Array.isArray(perms) ? perms : perms?.data ?? [];
                        return [id, new Set(list.map(permIdOf))];
                    } catch {
                        return [id, new Set()];
                    }
                })
            );
            setMatrix(Object.fromEntries(entries));
        } catch (e) {
            setError(e?.message || t("No se pudieron cargar los roles."));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    async function togglePermission(role, perm) {
        const rid = roleIdOf(role);
        const pid = permIdOf(perm);
        const has = matrix[rid]?.has(pid);
        const key = `${rid}:${pid}`;
        setBusyKey(key);
        try {
            if (has) {
                await authorizationApi.removePermission(rid, pid);
            } else {
                await authorizationApi.assignPermission(rid, pid);
            }
            setMatrix((prev) => {
                const next = new Set(prev[rid] ?? []);
                if (has) next.delete(pid);
                else next.add(pid);
                return { ...prev, [rid]: next };
            });
        } catch (e) {
            setError(e?.message || t("No se pudo actualizar el permiso."));
        } finally {
            setBusyKey(null);
        }
    }

    async function saveRole() {
        if (!form.roleName.trim()) {
            setFormError(t("El nombre del rol es requerido"));
            return;
        }
        setSaving(true);
        setFormError(null);
        try {
            await authorizationApi.createRole({
                roleName: form.roleName.trim(),
                description: form.description.trim() || null,
            });
        } catch (e) {
            setSaving(false);
            setFormError(e?.message || t("No se pudo crear el rol."));
            return;
        }
        setSaving(false);
        setModalOpen(false);
        setForm({ roleName: "", description: "" });
        load();
    }

    async function confirmDelete() {
        if (!pendingDelete) return;
        try {
            await authorizationApi.deleteRole(roleIdOf(pendingDelete));
            setPendingDelete(null);
            load();
        } catch (e) {
            setError(e?.message || t("No se pudo eliminar el rol."));
        }
    }

    return (
        <Card padding="lg" style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: c.text.primary }}>
                    {t("Roles y permisos")}
                </Text>
                <Button
                    variant="primary"
                    size="sm"
                    onPress={() => {
                        setForm({ roleName: "", description: "" });
                        setFormError(null);
                        setModalOpen(true);
                    }}
                    leftIcon={<Feather name="plus" size={14} color={c.brand.textOnPrimary} />}
                >
                    {t("Nuevo rol")}
                </Button>
            </View>

            {error && <Alert type="error" message={error} />}
            {loading ? (
                <Text style={{ color: c.text.secondary }}>{t("Cargando...")}</Text>
            ) : roles.length === 0 ? (
                <EmptyState icon="shield" title={t("Sin roles")} description={t("Crea el primero")} />
            ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                    {roles.map((role) => {
                        const rid = roleIdOf(role);
                        return (
                            <View
                                key={rid}
                                style={{
                                    paddingVertical: 12,
                                    borderBottomWidth: 1,
                                    borderBottomColor: c.border.primary,
                                    gap: 8,
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <Badge variant="primary" size="sm">
                                        {role.roleName ?? role.role_name ?? rid}
                                    </Badge>
                                    <Text style={{ flex: 1, color: c.text.secondary, fontSize: 12 }} numberOfLines={1}>
                                        {role.description ?? ""}
                                    </Text>
                                    <Button variant="danger" size="sm" onPress={() => setPendingDelete(role)}>
                                        {t("Eliminar")}
                                    </Button>
                                </View>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                    {permissions.map((perm) => {
                                        const pid = permIdOf(perm);
                                        const key = `${rid}:${pid}`;
                                        return (
                                            <Checkbox
                                                key={key}
                                                label={permNameOf(perm)}
                                                checked={matrix[rid]?.has(pid) ?? false}
                                                disabled={busyKey === key}
                                                onToggle={() => togglePermission(role, perm)}
                                            />
                                        );
                                    })}
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            <BaseModal
                visible={modalOpen}
                onClose={() => (saving ? null : setModalOpen(false))}
                title={t("Nuevo rol")}
                icon="shield"
                iconColor={c.brand.primary}
                size="sm"
                footer={
                    <>
                        <Button variant="outline" onPress={() => setModalOpen(false)} disabled={saving}>
                            {t("Cancelar")}
                        </Button>
                        <Button variant="primary" onPress={saveRole} loading={saving}>
                            {t("Crear rol")}
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
                        label={t("Nombre del rol")}
                        required
                        value={form.roleName}
                        onChangeText={(v) => setForm((p) => ({ ...p, roleName: v }))}
                        placeholder="SCHOOL_ADMIN"
                    />
                    <TextInput
                        label={t("Descripción")}
                        value={form.description}
                        onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
                    />
                </View>
            </BaseModal>

            <ConfirmModal
                visible={pendingDelete != null}
                onClose={() => setPendingDelete(null)}
                onConfirm={confirmDelete}
                variant="danger"
                title={t("Eliminar rol")}
                message={t("Se eliminará el rol. ¿Continuar?")}
                confirmText={t("Eliminar")}
            />
        </Card>
    );
}

export default RolesManager;
