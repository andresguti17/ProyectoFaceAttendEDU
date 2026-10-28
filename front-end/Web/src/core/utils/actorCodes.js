// ============================================================
//  FaceAttend EDU — Códigos de actor autogenerados
//  Correlativo "{PREFIJO}-{sede}-NNN" (p. ej. DOC-ICT-041, ADM-ICT-002)
//  a partir de los códigos ya existentes del mismo tipo de actor en la sede.
// ============================================================

/** Prefijo y tipo de actor académico por rol del formulario. */
export const ACTOR_CODE_BY_ROLE = {
    teacher: { prefix: "DOC", actorTypeId: 2 },
    admin: { prefix: "ADM", actorTypeId: 3 },
};

/**
 * Siguiente código libre para `role` en la sede `schoolId`.
 * @param {Array} actors - academic actors (actorCode, actorTypeId, schoolId)
 * @param {{ role: "teacher"|"admin", schoolId: string, schoolShort: string }} target
 */
export function nextActorCode(actors, { role, schoolId, schoolShort }) {
    const { prefix: kind, actorTypeId } = ACTOR_CODE_BY_ROLE[role];
    const prefix = `${kind}-${schoolShort}-`;
    let max = 0;
    for (const a of actors ?? []) {
        if (Number(a?.actorTypeId ?? a?.actor_type_id) !== actorTypeId) continue;
        if (String(a?.schoolId ?? a?.school_id) !== String(schoolId)) continue;
        const code = String(a?.actorCode ?? "");
        if (!code.startsWith(prefix)) continue;
        const n = Number.parseInt(code.slice(prefix.length), 10);
        if (!Number.isNaN(n) && n > max) max = n;
    }
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
