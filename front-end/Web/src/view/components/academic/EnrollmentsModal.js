// ============================================================
//  FaceAttend EDU — EnrollmentsModal
//
//  Matrículas de una ficha (HU-ACAD-004, FR 2.3.1): cambiar estado
//  (Active/Withdrawn/Completed) y desmatricular. Solo admin
//  (academic.enrollment:manage).
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, Badge, Button, EmptyState, AnimatedDropdown } from "../common";
import { BaseModal } from "../common/modals/BaseModal";
import { ConfirmModal } from "../common/modals/ConfirmModal";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { academicApi } from "../../../services/api/academicApi";
import {
    actorMap,
    actorTypeMap,
    cohortRoster,
    fullName,
    personMap,
    programMap,
    resetReferenceData,
} from "../../../services/api/referenceData";

const STATUS_META = {
    Active: { variant: "success", label: "Activa" },
    Withdrawn: { variant: "warning", label: "Retirada" },
    Completed: { variant: "info", label: "Completada" },
};

function enrollmentIdOf(e) {
    return e?.enrollmentId ?? e?.enrollment_id ?? e?.id ?? null;
}

function actorIdOf(e) {
    return e?.academicActorId ?? e?.academic_actor_id ?? null;
}

function statusOf(e) {
    return e?.enrollmentStatus ?? e?.enrollment_status ?? "Active";
}

export default function EnrollmentsModal({ visible, cohort, onClose }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    const [enrollments, setEnrollments] = useState([]);
    const [names, setNames] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [selectedActor, setSelectedActor] = useState("");
    const [enrolling, setEnrolling] = useState(false);

    const load = useCallback(async () => {
        if (!visible || cohort?.cohortId == null) return;
        setLoading(true);
        setError(null);
        try {
            const [list, roster, actors, persons, types, programs] = await Promise.all([
                academicApi.cohortEnrollments(cohort.cohortId),
                cohortRoster(cohort.cohortId).catch(() => []),
                actorMap().catch(() => new Map()),
                personMap().catch(() => new Map()),
                actorTypeMap().catch(() => new Map()),
                programMap().catch(() => new Map()),
            ]);
            const arr = Array.isArray(list) ? list : list?.data ?? list?.content ?? [];
            setEnrollments(arr);
            setNames(new Map((roster ?? []).map((r) => [r.academicActorId, r.name])));
            const enrolled = new Set(
                arr.map((e) => Number(e?.academicActorId ?? e?.academic_actor_id)).filter((n) => Number.isInteger(n))
            );
            const studentTypeId = [...types.values()].find(
                (ty) => String(ty.code ?? ty.name ?? "").trim().toUpperCase() === "STUDENT"
            )?.actorTypeId;
            const program = programs.get?.(Number(cohort.programId));
            const schoolId = program?.schoolId ?? program?.school_id ?? null;
            const rows = [];
            for (const actor of actors.values()) {
                const actorId = Number(actor.academicActorId);
                if (!Number.isInteger(actorId) || enrolled.has(actorId)) continue;
                if (studentTypeId != null && Number(actor.actorTypeId ?? actor.actor_type_id) !== Number(studentTypeId)) continue;
                const actorSchool = actor.schoolId ?? actor.school_id ?? null;
                if (schoolId != null && actorSchool != null && Number(actorSchool) !== Number(schoolId)) continue;
                const person = persons.get?.(actor.personId);
                rows.push({
                    value: String(actorId),
                    label: fullName(person) || String(actor.personId ?? actorId),
                    icon: "user",
                });
            }
            rows.sort((a, b) => a.label.localeCompare(b.label));
            setCandidates(rows);
            setSelectedActor("");
        } catch (e) {
            setError(e?.message || t("No se pudieron cargar las matrículas."));
        } finally {
            setLoading(false);
        }
    }, [visible, cohort, t]);

    useEffect(() => {
        load();
    }, [load]);

    async function changeStatus(enrollment, status) {
        const id = enrollmentIdOf(enrollment);
        if (id == null || statusOf(enrollment) === status) return;
        setBusyId(id);
        setError(null);
        try {
            await academicApi.updateEnrollmentStatus(id, status);
            resetReferenceData();
            setEnrollments((prev) =>
                prev.map((e) =>
                    enrollmentIdOf(e) === id
                        ? { ...e, enrollmentStatus: status, enrollment_status: status }
                        : e
                )
            );
        } catch (e) {
            setError(e?.message || t("No se pudo cambiar el estado."));
        } finally {
            setBusyId(null);
        }
    }

    async function enrollExisting() {
        const actorId = Number(selectedActor);
        if (!Number.isInteger(actorId)) return;
        setEnrolling(true);
        setError(null);
        try {
            await academicApi.createEnrollment({
                academicActorId: actorId,
                cohortId: Number(cohort.cohortId),
            });
            resetReferenceData();
            setSelectedActor("");
            await load();
        } catch (e) {
            setError(e?.message || t("No se pudo matricular."));
        } finally {
            setEnrolling(false);
        }
    }

    async function confirmDelete() {
        const id = pendingDelete ? enrollmentIdOf(pendingDelete) : null;
        if (id == null) return;
        setBusyId(id);
        try {
            await academicApi.deleteEnrollment(id);
            resetReferenceData();
            setEnrollments((prev) => prev.filter((e) => enrollmentIdOf(e) !== id));
            setPendingDelete(null);
        } catch (e) {
            setError(e?.message || t("No se pudo desmatricular."));
        } finally {
            setBusyId(null);
        }
    }

    if (!visible) return null;

    return (
        <BaseModal
            visible
            onClose={onClose}
            title={t("Matrículas")}
            subtitle={cohort?.code ?? ""}
            icon="users"
            iconColor={c.brand.primary}
            size="md"
            footer={
                <Button variant="ghost" onPress={onClose}>
                    {t("Cerrar")}
                </Button>
            }
        >
            {error && (
                <View style={{ marginBottom: 12 }}>
                    <Alert type="error" message={error} />
                </View>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "flex-end" }}>
                <View style={{ flex: 1 }}>
                    <AnimatedDropdown
                        items={candidates}
                        value={selectedActor}
                        onSelect={setSelectedActor}
                        placeholder={t("Matricular estudiante existente...")}
                        searchable
                        searchPlaceholder={t("Buscar...")}
                        triggerIcon="user-plus"
                    />
                </View>
                <Button
                    variant="primary"
                    size="sm"
                    disabled={!selectedActor || enrolling || loading}
                    loading={enrolling}
                    onPress={enrollExisting}
                >
                    {t("Matricular")}
                </Button>
            </View>
            {loading ? (
                <Text style={{ color: c.text.secondary }}>{t("Cargando...")}</Text>
            ) : enrollments.length === 0 ? (
                <EmptyState
                    icon="users"
                    title={t("Sin matrículas")}
                    description={t("Esta ficha no tiene estudiantes matriculados")}
                />
            ) : (
                <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                    {enrollments.map((enrollment) => {
                        const id = enrollmentIdOf(enrollment);
                        const actorId = actorIdOf(enrollment);
                        const status = statusOf(enrollment);
                        const meta = STATUS_META[status] || { variant: "default", label: status };
                        const busy = busyId === id;
                        return (
                            <View
                                key={id ?? actorId}
                                style={{
                                    paddingVertical: 10,
                                    borderBottomWidth: 1,
                                    borderBottomColor: c.border.primary,
                                    gap: 8,
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <Feather name="user" size={14} color={c.text.secondary} />
                                    <Text style={{ flex: 1, fontWeight: "600", color: c.text.primary }} numberOfLines={1}>
                                        {names.get(actorId) || `${t("Actor")} ${actorId ?? "—"}`}
                                    </Text>
                                    <Badge variant={meta.variant} size="sm">
                                        {t(meta.label)}
                                    </Badge>
                                </View>
                                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                                    {Object.keys(STATUS_META).map((s) => (
                                        <Button
                                            key={s}
                                            variant={status === s ? "primary" : "outline"}
                                            size="sm"
                                            disabled={busy || status === s}
                                            onPress={() => changeStatus(enrollment, s)}
                                        >
                                            {t(STATUS_META[s].label)}
                                        </Button>
                                    ))}
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        disabled={busy}
                                        onPress={() => setPendingDelete(enrollment)}
                                    >
                                        {t("Desmatricular")}
                                    </Button>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {pendingDelete != null && (
                <ConfirmModal
                    visible
                    onClose={() => setPendingDelete(null)}
                    onConfirm={confirmDelete}
                    loading={busyId != null}
                    variant="danger"
                    title={t("Desmatricular")}
                    message={t("Se eliminará la matrícula de la ficha. ¿Continuar?")}
                    confirmText={t("Desmatricular")}
                />
            )}
        </BaseModal>
    );
}
