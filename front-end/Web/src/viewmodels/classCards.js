// ============================================================
//  FaceAttend EDU — classCards
//
//  Datos de las tarjetas de clase del kiosco de asistencia: por cada
//  bloque horario de hoy reúne curso, ficha, ambiente, matriculados y,
//  si ya existe la sesión de hoy, su estado y cuántos registraron.
//  Cada fuente falla por separado: sin alguna, la tarjeta se pinta con
//  lo que sí se tenga en vez de quedar vacía.
// ============================================================

import { courseMap, cohortMap, listEnvironments, cohortRoster } from "../services/api/referenceData";
import { schedulingApi } from "../services/api/schedulingApi";
import { attendanceApi } from "../services/api/attendanceApi";

/** Estado de la tarjeta a partir del estado de la sesión de hoy (si existe). */
export function cardStatusOf(session) {
    switch (session?.sessionStatus) {
        case "Open":
            return "open";
        case "Closed":
            return "closed";
        case "Cancelled":
            return "cancelled";
        default:
            return "pending";
    }
}

/** "HH:MM" o "HH:MM:SS" -> minutos desde medianoche (null si no se entiende). */
export function toMinutes(time) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(time ?? ""));
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

/** "07:00:00" -> "07:00" para mostrar. */
export function shortTime(time) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(time ?? ""));
    return match ? `${match[1].padStart(2, "0")}:${match[2]}` : String(time ?? "");
}

/**
 * Pista de tiempo bajo el horario de la tarjeta. Devuelve { kind, minutes }
 * y la vista decide el texto:
 *  - starts_in   la clase aún no empieza (pendiente)
 *  - due         ya es hora de empezar (pendiente, dentro del horario)
 *  - missed      pendiente y el horario ya terminó
 *  - remaining   abierta, quedan `minutes`
 *  - overtime    abierta pero ya pasó la hora de fin
 *  - ended_ago   cerrada/cancelada, terminó hace `minutes`
 *  - duration    cerrada/cancelada dentro de su horario: solo la duración
 */
export function classTimeInfo(startsAt, endsAt, status, now = new Date()) {
    const start = toMinutes(startsAt);
    const end = toMinutes(endsAt);
    if (start == null || end == null) return { kind: "none", minutes: 0 };
    const current = now.getHours() * 60 + now.getMinutes();

    if (status === "open") {
        return current < end
            ? { kind: "remaining", minutes: end - current }
            : { kind: "overtime", minutes: current - end };
    }
    if (status === "closed" || status === "cancelled") {
        return current >= end
            ? { kind: "ended_ago", minutes: current - end }
            : { kind: "duration", minutes: end - start };
    }
    if (current < start) return { kind: "starts_in", minutes: start - current };
    if (current < end) return { kind: "due", minutes: 0 };
    return { kind: "missed", minutes: current - end };
}

/** 125 -> { hours: 2, minutes: 5 }. */
export function splitMinutes(total) {
    const safe = Math.max(0, Math.round(total));
    return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

const safe = (run, fallback) =>
    Promise.resolve()
        .then(run)
        .then((value) => (value == null ? fallback : value))
        .catch(() => fallback);

const asList = (value) => (Array.isArray(value) ? value : Array.isArray(value?.content) ? value.content : []);

/**
 * Carga los detalles de las tarjetas. Devuelve Map scheduleBlockId -> {
 *   courseName, courseCode, fichaCode, environmentName, capacity,
 *   enrolled, status, registered
 * }; `registered` es null mientras no haya sesión abierta o cerrada.
 */
export async function loadClassCards(blocks, today) {
    const [courses, cohorts, environments, sessions] = await Promise.all([
        safe(() => courseMap(), new Map()),
        safe(() => cohortMap(), new Map()),
        safe(() => listEnvironments(), []),
        safe(() => schedulingApi.listSessions(), []),
    ]);
    const environmentList = asList(environments);
    const sessionList = asList(sessions);

    const entries = await Promise.all(
        blocks.map(async (block) => {
            const course = courses.get?.(block.courseId);
            const cohort = cohorts.get?.(block.cohortId);
            const environment = environmentList.find((e) => e.environmentId === block.environmentId);
            const roster = await safe(() => cohortRoster(block.cohortId), []);
            const session = sessionList.find(
                (s) => s.scheduleBlockId === block.scheduleBlockId && s.sessionDate === today
            );
            const status = cardStatusOf(session);

            let registered = null;
            if (session && (status === "open" || status === "closed")) {
                const records = await safe(() => attendanceApi.recordsBySession(session.classSessionId), null);
                if (records) {
                    registered = asList(records).filter(
                        (r) => (r.attendanceStatus ?? r.attendance_status) !== "Absent"
                    ).length;
                }
            }

            return [
                block.scheduleBlockId,
                {
                    courseName: course?.name ?? "",
                    courseCode: course?.code ?? "",
                    fichaCode: cohort?.code ?? "",
                    environmentName: environment?.name ?? "",
                    capacity: environment?.capacity ?? null,
                    enrolled: roster.length,
                    status,
                    registered,
                },
            ];
        })
    );
    return new Map(entries);
}
