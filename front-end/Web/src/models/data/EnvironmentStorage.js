// ============================================================
//  FaceAttend EDU — EnvironmentStorage
//
//  Lectura de ambientes: API de scheduling (GET /environments
//  + /schedule-blocks) con los mocks como respaldo si falla.
//  Las altas/ediciones siguen en AsyncStorage (fase de escrituras).
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_MODE } from "../../config/env";
import { mockEnvironments } from "./mockData";
import {
    dayLabel,
    fullName,
    hhmm,
    normalizeStatus,
    optional,
    personMap,
    courseMap,
    actorMap,
    userByPersonMap,
    listBlocks,
    listEnvironments,
} from "../../services/api/referenceData";

const STORAGE_KEY = "@faceattend_environments";
// Prefijos que generateId() crea: lo que empieza así es una alta local
// y se fusiona con la API; el resto (ids numéricos y mocks) no se re-sembran.
const LOCAL_PREFIX = "env_";

function generateId() {
    return `env_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
function generateScheduleId() {
    return `sch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Lectura ───────────────────────────────────────────────

async function localEnvironments() {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (env) => typeof env?.id === "string" && env.id.startsWith(LOCAL_PREFIX)
        );
    } catch {
        return [];
    }
}

function blockToSchedule(block, courses, actors, persons, usersByPerson) {
    const course = courses.get(block.courseId);
    const actor = actors.get(block.instructorActorId);
    const person = actor?.personId ? persons.get(actor.personId) : null;
    const user = actor?.personId ? usersByPerson.get(actor.personId) : null;
    return {
        id: String(block.scheduleBlockId),
        courseCode: course?.code ?? "",
        courseName: course?.name ?? "",
        instructor: user?.userId ?? null,
        instructorName: fullName(person),
        startTime: hhmm(block.startsAt),
        endTime: hhmm(block.endsAt),
        days: [dayLabel(block.dayOfWeek)].filter(Boolean),
    };
}

async function environmentsFromApi() {
    const [environments, blocks] = await Promise.all([listEnvironments(), listBlocks()]);
    if (!Array.isArray(environments)) return [];

    // Cargas secundarias: si alguna falla, el ambiente igual se muestra
    // (sin nombre de curso/instructor en sus bloques).
    const [courses, actors, persons, usersByPerson] = await Promise.all([
        optional(courseMap(), new Map()),
        optional(actorMap(), new Map()),
        optional(personMap(), new Map()),
        optional(userByPersonMap(), new Map()),
    ]);

    return environments.map((env) => ({
        id: String(env.environmentId),
        number: env.code ?? "",
        name: env.name ?? "",
        description: env.name ?? "", // el backend no expone descripción
        capacity: env.capacity ?? 0,
        status: normalizeStatus(env.status),
        schedules: blocks
            .filter((block) => block.environmentId === env.environmentId)
            .map((block) => blockToSchedule(block, courses, actors, persons, usersByPerson)),
    }));
}

export async function loadEnvironments() {
    const local = await localEnvironments();
    try {
        return [...(await environmentsFromApi()), ...local];
    } catch (error) {
        if (API_MODE === "mock") {
            console.warn("[FaceAttend] loadEnvironments: API no disponible, uso mock —", error?.message);
            return [...mockEnvironments, ...local];
        }
        throw error;
    }
}

// ── Escritura local (pendiente de cablear al backend) ─────

export async function saveEnvironments(environments) {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(environments));
    } catch (error) { /* fallo silencioso */ }
}

export async function addEnvironment(existing, draft) {
    const newEnv = { id: generateId(), ...draft };
    const updated = [...existing, newEnv];
    await saveEnvironments(updated);
    return updated;
}

export async function updateEnvironment(existing, id, patch) {
    const updated = existing.map(e => e.id === id ? { ...e, ...patch } : e);
    await saveEnvironments(updated);
    return updated;
}

export async function deleteEnvironment(existing, id) {
    const updated = existing.filter(e => e.id !== id);
    await saveEnvironments(updated);
    return updated;
}

export async function addScheduleToEnvironment(existing, envId, draft) {
    const newSchedule = { id: generateScheduleId(), ...draft };
    const updated = existing.map(e =>
        e.id === envId
            ? { ...e, schedules: [...e.schedules, newSchedule] }
            : e
    );
    await saveEnvironments(updated);
    return updated;
}

export async function updateSchedule(existing, envId, scheduleId, patch) {
    const updated = existing.map(e =>
        e.id === envId
            ? {
                ...e,
                schedules: e.schedules.map(s =>
                    s.id === scheduleId ? { ...s, ...patch } : s
                ),
            }
            : e
    );
    await saveEnvironments(updated);
    return updated;
}

export async function deleteSchedule(existing, envId, scheduleId) {
    const updated = existing.map(e =>
        e.id === envId
            ? { ...e, schedules: e.schedules.filter(s => s.id !== scheduleId) }
            : e
    );
    await saveEnvironments(updated);
    return updated;
}
