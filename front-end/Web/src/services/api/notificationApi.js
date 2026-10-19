// Notification (ms-notification :8088). Alertas y tipos de alerta.
import { request } from "../../api/apiClient";
import { endpoints } from "../../api/endpoints";

export const notificationApi = {
    listAlerts: (params) =>
        request(endpoints.notification.alerts, { method: "GET", query: params }),
    createAlert: (b) =>
        request(endpoints.notification.alerts, { method: "POST", body: b }),
    resolveAlert: (id) =>
        request(endpoints.notification.alertResolve(id), { method: "PATCH" }),
    deleteAlert: (id) =>
        request(endpoints.notification.alertById(id), { method: "DELETE" }),
    listAlertTypes: () =>
        request(endpoints.notification.alertTypes, { method: "GET" }),
    createAlertType: (b) =>
        request(endpoints.notification.alertTypes, { method: "POST", body: b }),
};
