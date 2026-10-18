// ============================================================
//  FaceAttend EDU — Notificaciones de reportes
//
//  Cablea los botones "Notificar" de Reportes al backend:
//  POST /api/v1/alerts { academic_actor_id, alert_type_id }.
//
//  El tipo de alerta se resuelve por código en tiempo de ejecución
//  (los IDs autoincrementales dependen del seed, nunca se hardcodean).
//  Las respuestas del servicio Go pueden llegar en PascalCase o
//  snake_case: se aceptan ambas formas.
// ============================================================

import { notificationApi } from "./notificationApi";

// Orden de preferencia para avisos de asistencia.
const ATTENDANCE_TYPE_CODES = [
    "ATTENDANCE_LOW",
    "ATTENDANCE_ABSENTEEISM",
    "ATTENDANCE_TARDINESS",
];

function normalizeCode(value) {
    return String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function typeIdOf(type) {
    return type?.alert_type_id ?? type?.AlertTypeID ?? type?.alertTypeId ?? null;
}

function codeOf(type) {
    return type?.code ?? type?.Code ?? "";
}

function typeListOf(response) {
    if (Array.isArray(response)) return response;
    return response?.alert_types ?? response?.content ?? [];
}

/**
 * Resuelve el ID del tipo de alerta de asistencia.
 * @throws si el backend no expone ningún tipo.
 */
export async function resolveAttendanceAlertType() {
    const list = typeListOf(await notificationApi.listAlertTypes());
    const match =
        ATTENDANCE_TYPE_CODES.map((code) =>
            list.find((t) => normalizeCode(codeOf(t)) === code)
        ).find(Boolean) ?? list[0];
    const id = match ? typeIdOf(match) : null;
    if (id == null) throw new Error("No attendance alert type available");
    return id;
}

/**
 * Crea una alerta de asistencia para un actor académico.
 * @param {string|number} actorId - academic_actor_id (el `id` del estudiante en Reportes).
 */
export async function notifyStudentByActorId(actorId, alertTypeId = null) {
    if (actorId == null || String(actorId).trim() === "") {
        throw new Error("Student is not synced with the backend yet");
    }
    const id = Number(actorId);
    if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Student is not synced with the backend yet");
    }
    const typeId = alertTypeId ?? (await resolveAttendanceAlertType());
    await notificationApi.createAlert({ academic_actor_id: id, alert_type_id: typeId });
}

/**
 * Notificación masiva: un tipo resuelto una sola vez, altas en paralelo.
 * @returns {{ sent: number }} — lanza si alguna falla.
 */
export async function notifyActors(actorIds) {
    const ids = [
        ...new Set(
            (actorIds ?? [])
                .filter((v) => v != null && String(v).trim() !== "")
                .map(Number)
                .filter((n) => Number.isInteger(n) && n > 0)
        ),
    ];
    if (ids.length === 0) throw new Error("There are no synced students to notify");
    const typeId = await resolveAttendanceAlertType();
    const results = await Promise.allSettled(
        ids.map((id) => notifyStudentByActorId(id, typeId))
    );
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
        throw new Error(`${failed.length} of ${ids.length} notifications failed`);
    }
    return { sent: ids.length };
}
