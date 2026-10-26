// Attendance (ms-attendance :8085). Registros de asistencia y justificaciones.
import { request } from "../../api/apiClient";
import { endpoints } from "../../api/endpoints";

export const attendanceApi = {
    listRecords: (p) => request(endpoints.attendance.records, { method: "GET", query: p }),
    createRecord: (b) => request(endpoints.attendance.records, { method: "POST", body: b }),
    getRecord: (id) => request(endpoints.attendance.recordById(id), { method: "GET" }),
    updateRecord: (id, b) => request(endpoints.attendance.recordById(id), { method: "PUT", body: b }),
    deleteRecord: (id) => request(endpoints.attendance.recordById(id), { method: "DELETE" }),
    recordsByActor: (actorId) => request(endpoints.attendance.actorAttendance(actorId), { method: "GET" }),
    recordsBySession: (sessionId) => request(endpoints.attendance.sessionAttendance(sessionId), { method: "GET" }),
    // Spring acepta la lista como query string separada por comas.
    recordsSummary: (actorIds) =>
        request(endpoints.attendance.recordsSummary, {
            method: "GET",
            query: { academicActorIds: actorIds.join(",") },
        }),
    listJustifications: (p) => request(endpoints.attendance.justifications, { method: "GET", query: p }),
    getJustification: (id) => request(endpoints.attendance.justificationById(id), { method: "GET" }),
    createJustification: (b) => request(endpoints.attendance.justifications, { method: "POST", body: b }),
    updateJustification: (id, b) =>
        request(endpoints.attendance.justificationById(id), { method: "PUT", body: b }),
    deleteJustification: (id) =>
        request(endpoints.attendance.justificationById(id), { method: "DELETE" }),
    reviewJustification: (id, b) =>
        request(endpoints.attendance.justificationReview(id), { method: "PATCH", body: b }),
    listJustificationTypes: () => request(endpoints.attendance.justificationTypes, { method: "GET" }),
    createJustificationType: (b) => request(endpoints.attendance.justificationTypes, { method: "POST", body: b }),
    updateJustificationType: (id, b) =>
        request(endpoints.attendance.justificationTypeById(id), { method: "PUT", body: b }),
    deleteJustificationType: (id) =>
        request(endpoints.attendance.justificationTypeById(id), { method: "DELETE" }),
    justificationDocuments: (id) => request(endpoints.attendance.justificationDocuments(id), { method: "GET" }),
    // Sube el archivo real (multipart) a MinIO a través de attendance.
    uploadJustificationDocument: (id, file, fileName) => {
        const form = new FormData();
        form.append("file", file, fileName);
        return request(endpoints.attendance.justificationDocuments(id), { method: "POST", body: form, timeoutMs: 60000 });
    },
    // El archivo guardado, como Blob, para abrirlo en el navegador.
    supportingDocumentContent: (id) =>
        request(endpoints.attendance.supportingDocumentContent(id), { method: "GET", responseType: "blob" }),
};
