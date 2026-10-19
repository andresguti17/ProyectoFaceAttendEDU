// Configuration (ms-configuration :8087). Configs + casos biométricos.
import { request } from "../../api/apiClient";
import { endpoints } from "../../api/endpoints";

export const configurationApi = {
    listAcademic: (params) => request(endpoints.configuration.academic, { method: "GET", query: params }),
    createAcademic: (b) =>
        request(endpoints.configuration.academic, { method: "POST", body: b }),
    updateAcademic: (id, b) =>
        request(endpoints.configuration.academicById(id), { method: "PUT", body: b }),
    listSecurity: (params) => request(endpoints.configuration.security, { method: "GET", query: params }),
    createSecurity: (b) =>
        request(endpoints.configuration.security, { method: "POST", body: b }),
    updateSecurity: (id, b) =>
        request(endpoints.configuration.securityById(id), { method: "PUT", body: b }),
    listBiometricCases: (status) =>
        request(endpoints.configuration.biometricCases, { method: "GET", query: status ? { status } : undefined }),
    createBiometricCase: (b) =>
        request(endpoints.configuration.biometricCases, { method: "POST", body: b }),
    reviewBiometricCase: (id, b) =>
        request(endpoints.configuration.biometricCaseReview(id), { method: "PATCH", body: b }),
    schoolConfigurations: (schoolId) =>
        request(endpoints.configuration.schoolConfigurations(schoolId), { method: "GET" }),
};
