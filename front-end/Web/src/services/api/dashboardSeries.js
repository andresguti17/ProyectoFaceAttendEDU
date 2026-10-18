// ============================================================
//  FaceAttend EDU — Series del dashboard desde el backend
//
//  Las gráficas se derivan de sesiones de clase + registros de
//  asistencia reales (ms-scheduling + ms-attendance):
//  - diaria:  conteos por fecha (últimos N días con sesión)
//  - semanal: tasa por semana del año ("Sem N", con dailyData)
//  - reciente: últimos registros con actor, curso y estado
//
//  Sin sesiones/registros las series quedan vacías (los gráficos
//  pintan su estado vacío): nunca se inventan cifras.
// ============================================================

import { attendanceApi } from "./attendanceApi";
import { fetchAllPages } from "../../api/apiClient";
import { endpoints } from "../../api/endpoints";
import {
    actorMap,
    courseMap,
    listActors,
    listBlocks,
    personMap,
} from "./referenceData";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function listOf(response) {
    if (Array.isArray(response)) return response;
    return response?.content ?? [];
}

// Concurrencia acotada: cada petición pasa por la verificación de sesión
// en Kong; decenas en paralelo saturan identity y responden 503/timeout.
async function mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
        while (next < items.length) {
            const index = next;
            next += 1;
            results[index] = await fn(items[index], index);
        }
    });
    await Promise.all(workers);
    return results;
}

function sessionOf(raw) {
    return {
        id: raw?.classSessionId ?? raw?.class_session_id ?? null,
        blockId: raw?.scheduleBlockId ?? raw?.schedule_block_id ?? null,
        date: String(raw?.sessionDate ?? raw?.session_date ?? "").slice(0, 10),
        status: raw?.sessionStatus ?? raw?.session_status ?? null,
    };
}

function recordStatusOf(record) {
    return record?.attendanceStatus ?? record?.attendance_status ?? "";
}

function recordDateOf(record) {
    const captured = record?.capturedAt ?? record?.captured_at ?? "";
    return String(captured).slice(0, 10);
}

function dayLabelOf(isoDate) {
    const date = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(date.getTime())) return isoDate;
    return DAY_LABELS[date.getDay()];
}

function yearWeekOf(isoDate) {
    // Semana del año (1..53) compatible con el selector del dashboard.
    const date = new Date(`${isoDate}T12:00:00`);
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - yearStart) / 86400000);
    return Math.ceil((days + yearStart.getDay() + 1) / 7);
}

function emptyBucket() {
    return { present: 0, late: 0, absent: 0 };
}

function tally(bucket, status) {
    if (status === "Present" || status === "Justified") bucket.present += 1;
    else if (status === "Late") bucket.late += 1;
    else if (status === "Absent") bucket.absent += 1;
}

function rateOf(bucket) {
    const total = bucket.present + bucket.late + bucket.absent;
    if (total === 0) return 0;
    return Math.round(((bucket.present + bucket.late) / total) * 100);
}

/**
 * Sesiones en ventana, acotadas a la sede (vía bloques) y
 * opcionalmente a los bloques del instructor o a un cohorte.
 */
async function scopedSessions({ maxSessions = 15, instructorActorId = null, cohortId = null } = {}) {
    // Todas las sesiones en páginas acotadas (el listado completo supera
    // el timeout de una sola petición); las N más recientes con datos.
    const [sessionsRes, blocks] = await Promise.all([
        fetchAllPages(endpoints.scheduling.sessions, {}, { by: "offset", pageSize: 200, concurrency: 4 }).catch(() => []),
        listBlocks().catch(() => null),
    ]);
    const blockList = listOf(blocks);
    const blockIds = blocks ? new Set(blockList.map((b) => b?.scheduleBlockId ?? b?.schedule_block_id)) : null;
    const ownBlockIds =
        instructorActorId != null
            ? new Set(
                  blockList
                      .filter(
                          (b) =>
                              String(b?.instructorActorId ?? b?.instructor_actor_id ?? "") ===
                              String(instructorActorId)
                      )
                      .map((b) => b?.scheduleBlockId ?? b?.schedule_block_id)
              )
            : null;
    const today = new Date().toISOString().slice(0, 10);
    const inScope = listOf(sessionsRes)
        .map(sessionOf)
        .filter((s) => s.id != null && s.date)
        .filter((s) => !blockIds || blockIds.has(s.blockId))
        .filter((s) => ownBlockIds == null || ownBlockIds.has(s.blockId))
        .filter((s) => {
            if (cohortId == null) return true;
            const block = blockList.find(
                (b) => String(b?.scheduleBlockId ?? b?.schedule_block_id ?? "") === String(s.blockId)
            );
            return String(block?.cohortId ?? block?.cohort_id ?? "") === String(cohortId);
        });
    const inWindow = inScope
        // Las N sesiones más recientes con datos (sin corte por fecha: en
        // períodos sin clase la ventana de días quedaba vacía siempre).
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, maxSessions);
    const todaySessions = inScope.filter((s) => s.date === today);
    const closedToday = todaySessions.filter((s) =>
        ["closed", "cancelled"].includes(String(s.status ?? "").toLowerCase())
    ).length;
    return { inWindow, todaySessions, closedToday };
}

function bucketSessions(sessions, recordsBySession) {
    const byDate = new Map();
    for (const session of sessions) {
        for (const record of recordsBySession.get(session.id) ?? []) {
            const bucket = byDate.get(session.date) ?? emptyBucket();
            tally(bucket, recordStatusOf(record));
            byDate.set(session.date, bucket);
        }
    }
    return [...byDate.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, bucket]) => ({ date, day: dayLabelOf(date), ...bucket }));
}

/**
 * Serie diaria del actor (estudiante): sus registros por fecha.
 */
async function actorBuckets(academicActorId, maxDays = 30) {
    const records = listOf(await attendanceApi.recordsByActor(academicActorId).catch(() => []));
    const byDate = new Map();
    for (const record of records) {
        const date = recordDateOf(record);
        if (!date) continue;
        const bucket = byDate.get(date) ?? emptyBucket();
        tally(bucket, recordStatusOf(record));
        byDate.set(date, bucket);
    }
    // Los días más recientes con registros.
    return [...byDate.entries()]
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .slice(-maxDays)
        .map(([date, bucket]) => ({ date, day: dayLabelOf(date), ...bucket }));
}

function weeklyFromDaily(daily) {
    const byWeek = new Map();
    for (const entry of daily) {
        const week = yearWeekOf(entry.date);
        const bucket = byWeek.get(week) ?? { ...emptyBucket(), dailyData: [] };
        bucket.present += entry.present;
        bucket.late += entry.late;
        bucket.absent += entry.absent;
        bucket.dailyData.push({
            day: entry.day,
            present: entry.present,
            late: entry.late,
            absent: entry.absent,
        });
        byWeek.set(week, bucket);
    }
    return [...byWeek.entries()]
        .sort(([a], [b]) => a - b)
        .map(([week, bucket]) => ({
            week: `Sem ${week}`,
            rate: rateOf(bucket),
            dailyData: bucket.dailyData,
        }));
}

/**
 * Series del dashboard según el rol.
 * - admin:   toda la sede.
 * - teacher: solo sus bloques (instructorActorId).
 * - student: solo sus registros (academicActorId) + sesiones de su ficha.
 */
export async function dashboardSeries({ role, instructorActorId = null, academicActorId = null, cohortId = null } = {}) {
    const scope =
        role === "student" ? { instructorActorId: null, cohortId } : { instructorActorId: role === "teacher" ? instructorActorId : null, cohortId: null };
    const { inWindow, todaySessions, closedToday } = await scopedSessions(scope);
    const daily =
        role === "student" && academicActorId != null
            ? await actorBuckets(academicActorId)
            : await bucketsFromSessions(inWindow);
    return {
        daily,
        weekly: weeklyFromDaily(daily),
        meta: { sessionsToday: todaySessions.length, sessionsClosedToday: closedToday },
    };
}

async function bucketsFromSessions(sessions) {
    const recordsBySession = new Map();
    await mapLimit(sessions, 6, async (session) => {
        recordsBySession.set(session.id, await sessionRecords(session.id));
    });
    return bucketSessions(sessions, recordsBySession);
}

// Un reintento con pausa ante timeouts: el agregado por sesión a veces
// agota el tiempo bajo carga (verificación de sesión en Kong + SQL).
// Solo ante error lanzado, no ante sesión legítimamente vacía.
async function sessionRecords(sessionId) {
    try {
        return listOf(await attendanceApi.recordsBySession(sessionId));
    } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return listOf(await attendanceApi.recordsBySession(sessionId).catch(() => []));
    }
}

function fullNameOf(person) {
    return `${person?.name ?? ""} ${person?.lastName ?? person?.last_name ?? ""}`.trim();
}

function viewStatusOf(status) {
    if (status === "Late") return "late";
    if (status === "Absent") return "absent";
    return "on_time";
}

function timeAgoOf(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "";
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return "Ahora mismo";
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    return `Hace ${Math.floor(hours / 24)} d`;
}

/**
 * Actividad reciente: últimos registros de las sesiones más
 * recientes, con estudiante, curso y hora relativa.
 */
export async function recentActivity({ limit = 5, maxSessions = 5 } = {}) {
    const [sessionsRes, blocks, actors, persons, courses] = await Promise.all([
        fetchAllPages(endpoints.scheduling.sessions, {}, { by: "offset", pageSize: 200, concurrency: 4 }).catch(() => []),
        listBlocks().catch(() => []),
        actorMap().catch(() => new Map()),
        personMap().catch(() => new Map()),
        courseMap().catch(() => new Map()),
    ]);
    const blockList = listOf(blocks);
    const sessions = listOf(sessionsRes)
        .map(sessionOf)
        .filter((s) => s.id != null && s.date)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, maxSessions);

    const items = [];
    for (const session of sessions) {
        const records = listOf(await attendanceApi.recordsBySession(session.id).catch(() => []));
        const block = blockList.find(
            (b) => String(b?.scheduleBlockId ?? b?.schedule_block_id ?? "") === String(session.blockId)
        );
        const courseId = block?.courseId ?? block?.course_id ?? null;
        const course = courseId != null ? courses.get?.(courseId) : null;
        const courseLabel = course?.code ?? course?.name ?? (courseId != null ? String(courseId) : "—");
        for (const record of records) {
            const rawActorId = record?.academicActorId ?? record?.academic_actor_id ?? null;
            const actorId = rawActorId != null ? Number(rawActorId) : null;
            const actor = actorId != null ? actors.get?.(actorId) ?? actors.get?.(rawActorId) : null;
            const person = actor?.personId ? persons.get?.(actor.personId) : null;
            const status = recordStatusOf(record);
            items.push({
                id: String(record?.attendanceRecordId ?? record?.attendance_record_id ?? `${session.id}-${actorId}`),
                status: viewStatusOf(status),
                student: fullNameOf(person) || "—",
                course: courseLabel,
                time: timeAgoOf(record?.capturedAt ?? record?.captured_at ?? ""),
                capturedAt: record?.capturedAt ?? record?.captured_at ?? "",
            });
        }
    }
    return items
        .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))
        .slice(0, limit)
        .map(({ capturedAt, ...rest }) => rest);
}
