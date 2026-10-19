// ============================================================
//  FaceAttend EDU — Notificación automática del resultado de
//  justificaciones (HU-JUS-003, FR 6.3).
//
//  Al aprobar/rechazar se crea una alerta DASHBOARD para el actor
//  del estudiante. El tipo JUSTIFICATION_RESULT se resuelve por
//  código y se crea si no existe (los IDs dependen del seed).
// ============================================================

import { notificationApi } from "./notificationApi";

const RESULT_TYPE_CODE = "JUSTIFICATION_RESULT";

function codeOf(type) {
    return String(type?.code ?? type?.Code ?? "").trim().toUpperCase();
}

function typeIdOf(type) {
    return type?.alertTypeId ?? type?.alert_type_id ?? type?.AlertTypeID ?? type?.id ?? null;
}

function typeListOf(response) {
    if (Array.isArray(response)) return response;
    return (
        response?.alert_types ??
        response?.AlertTypes ??
        response?.data ??
        response?.content ??
        []
    );
}

/**
 * Resuelve el ID del tipo de resultado de justificación,
 * creándolo si el backend aún no lo tiene.
 */
export async function resolveJustificationResultType() {
    const list = typeListOf(await notificationApi.listAlertTypes());
    const found = list.find((t) => codeOf(t) === RESULT_TYPE_CODE);
    if (found) return typeIdOf(found);
    const created = await notificationApi.createAlertType({
        code: RESULT_TYPE_CODE,
        name: "Justification review result",
        severity: "INFO",
        channel: "DASHBOARD",
    });
    const id = created?.alertTypeId ?? created?.alert_type_id ?? typeIdOf(created);
    if (id == null) throw new Error("No justification result alert type available");
    return id;
}

/**
 * Crea la alerta de resultado para el estudiante.
 * Nunca debe tumbar el flujo de revisión: el llamador la
 * invoca en fire-and-forget con su propio catch.
 */
export async function notifyJustificationResult(actorId) {
    const id = Number(actorId);
    if (!Number.isInteger(id) || id <= 0) return;
    const typeId = await resolveJustificationResultType();
    await notificationApi.createAlert({ academic_actor_id: id, alert_type_id: typeId });
}
