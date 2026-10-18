// Scheduling (ms-scheduling :8084). Ambientes, bloques y sesiones de clase.
import { request } from "../../api/apiClient";
import { endpoints } from "../../api/endpoints";

export const schedulingApi = {
    listEnvironments: () => request(endpoints.scheduling.environments, { method: "GET" }),
    createEnvironment: (b) => request(endpoints.scheduling.environments, { method: "POST", body: b }),
    updateEnvironment: (id, b) =>
        request(endpoints.scheduling.environmentById(id), { method: "PUT", body: b }),
    deleteEnvironment: (id) =>
        request(endpoints.scheduling.environmentById(id), { method: "DELETE" }),
    listBlocks: () => request(endpoints.scheduling.blocks, { method: "GET" }),
    createBlock: (b) => request(endpoints.scheduling.blocks, { method: "POST", body: b }),
    updateBlock: (id, b) =>
        request(endpoints.scheduling.blockById(id), { method: "PUT", body: b }),
    deleteBlock: (id) =>
        request(endpoints.scheduling.blockById(id), { method: "DELETE" }),
    listSessions: () => request(endpoints.scheduling.sessions, { method: "GET" }),
    createSession: (b) => request(endpoints.scheduling.sessions, { method: "POST", body: b }),
    // openedBy/closedBy: academic_actor_id del instructor que abre/cierra la
    // sesión (AGENTS.md §6 regla 8 — debe quedar registrado quién cerró la
    // clase). El endpoint Java los acepta en el cuerpo pero son opcionales,
    // así que si no se conoce el actor no se envía cuerpo alguno.
    openSession: (id, openedBy) =>
        request(endpoints.scheduling.sessionOpen(id), {
            method: "POST",
            body: openedBy != null ? { openedBy } : undefined,
        }),
    closeSession: (id, closedBy) =>
        request(endpoints.scheduling.sessionClose(id), {
            method: "POST",
            body: closedBy != null ? { closedBy } : undefined,
        }),
    cancelSession: (id) => request(endpoints.scheduling.sessionCancel(id), { method: "POST" }),
};
