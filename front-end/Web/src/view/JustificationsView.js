// ============================================================
//  FaceAttend EDU — Justifications VIEW (Presentation Layer)
//
//  RESPONSABILIDAD: Presentación de justificaciones de asistencia
//
//  ✓ Alumno: envía y consulta sus justificaciones (HU-JUS-001)
//  ✓ Instructor/Admin: evalúa pendientes de su alcance (HU-JUS-002)
//  ✓ La decisión pasa por ConfirmModal (regla de navegación:
//    toda acción crítica requiere confirmación)
//
//  Toda la lógica de negocio está en useJustificationsViewModel.
// ============================================================

import React from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, Button, ConfirmModal, PageHeader } from "./components/common";
import { useTheme } from "./components/hooks/useTheme";
import { useResponsive } from "./components/hooks/useResponsive";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useJustificationsViewModel } from "../viewmodels/useJustificationsViewModel";
import {
    JustificationDetailModal,
    JustificationTypesManager,
    ReviewJustifications,
    StudentJustifications,
    SubmitJustificationModal,
} from "./authorized/justifications";
import { useRolePermissions } from "../viewmodels/useRolePermissions";

export default function JustificationsView() {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const vm = useJustificationsViewModel();
    const permissions = useRolePermissions();
    const canManageTypes = permissions.canManageJustificationTypes ?? false;

    if (vm.isLoading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={c.brand.primary} />
            </View>
        );
    }

    const subtitle = vm.isReviewer
        ? `${t("Revisa las justificaciones de tu alcance")} · ${vm.pendingCount} ${t("pendientes")}`
        : `${t("Envía y consulta tus justificaciones")} · ${vm.eligibleRecords.length} ${t("pendientes de justificar")}`;

    const confirmMessage =
        vm.decision === "Approved"
            ? t("¿Aprobar la justificación? El registro de asistencia pasará a Justificada.")
            : t("¿Rechazar la justificación? El registro de asistencia conservará su estado original.");

    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            <PageHeader
                title={t("Justificaciones")}
                subtitle={subtitle}
                actions={
                    !vm.isReviewer && (
                        <Button
                            variant="primary"
                            size="sm"
                            onPress={() => vm.setListTab("eligible")}
                            leftIcon={<Feather name="file-plus" size={16} color={c.brand.textOnPrimary} />}
                        >
                            {t("Nueva justificación")}
                        </Button>
                    )
                }
            />

            <ScrollView
                contentContainerStyle={{ padding: isSmall ? 16 : 24, gap: 16 }}
                showsVerticalScrollIndicator={false}
            >
                {vm.error && (
                    <Alert type="error" title={t("No se pudo cargar")} message={vm.error} closable />
                )}
                {vm.feedback && (
                    <Alert
                        type={vm.feedback.type === "success" ? "success" : "error"}
                        message={vm.feedback.message}
                        closable
                        onClose={vm.clearFeedback}
                    />
                )}

                {vm.isReviewer ? (
                    <>
                        <ReviewJustifications vm={vm} />
                        {canManageTypes && <JustificationTypesManager />}
                    </>
                ) : (
                    <StudentJustifications vm={vm} />
                )}
            </ScrollView>

            {/* Envío de justificación (alumno) — montado solo al abrir para
                reiniciar el formulario en cada envío. */}
            {vm.submitOpen && (
                <SubmitJustificationModal
                    visible={vm.submitOpen}
                    target={vm.submitTarget}
                    types={vm.types}
                    submitting={vm.isSubmitting}
                    errorMessage={vm.feedback && vm.feedback.type === "error" ? vm.feedback.message : null}
                    onClose={vm.closeSubmit}
                    onSubmit={vm.submit}
                />
            )}

            {/* Detalle y evaluación (instructor/admin) */}
            <JustificationDetailModal
                row={vm.detail}
                typeName={vm.detail ? vm.typeNameOf(vm.detail.justificationTypeId) : ""}
                documents={vm.documents}
                documentsLoading={vm.documentsLoading}
                notes={vm.notes}
                onNotesChange={vm.setNotes}
                onClose={vm.closeDetail}
                onDecide={vm.askDecision}
            />

            <ConfirmModal
                visible={vm.confirmOpen}
                onClose={() => vm.setConfirmOpen(false)}
                onConfirm={vm.confirmReview}
                title={vm.decision === "Approved" ? t("Aprobar justificación") : t("Rechazar justificación")}
                message={confirmMessage}
                variant={vm.decision === "Approved" ? "default" : "danger"}
                confirmText={vm.decision === "Approved" ? t("Aprobar") : t("Rechazar")}
                cancelText={t("Cancelar")}
                loading={vm.isReviewing}
            />

            {/* Retiro de justificación pendiente (alumno) */}
            {vm.withdrawOpen && (
                <ConfirmModal
                    visible
                    onClose={() => vm.setWithdrawOpen(false)}
                    onConfirm={vm.confirmWithdraw}
                    title={t("Retirar justificación")}
                    message={t("Se retirará tu justificación pendiente. ¿Continuar?")}
                    variant="danger"
                    confirmText={t("Retirar")}
                    cancelText={t("Cancelar")}
                    loading={vm.isWithdrawing}
                />
            )}
        </View>
    );
}
