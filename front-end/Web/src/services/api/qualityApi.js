// Quality (ms-quality :8089). Evaluaciones ISO25010/29110/ISTQB.
import { request } from "../../api/apiClient";
import { endpoints } from "../../api/endpoints";

export const qualityApi = {
    characteristics: () => request(endpoints.quality.characteristics, { method: "GET" }),
    listEvaluations: (params) =>
        request(endpoints.quality.evaluations, { method: "GET", query: params }),
    serviceSummary: (service) =>
        request(endpoints.quality.serviceSummary(service), { method: "GET" }),
    processProfile: () => request(endpoints.quality.processProfile, { method: "GET" }),
    listProjects: () => request(endpoints.quality.projects, { method: "GET" }),
    istqbCategories: () => request(endpoints.quality.istqbCategories, { method: "GET" }),
    health: () => request("/health", { method: "GET" }),
};
