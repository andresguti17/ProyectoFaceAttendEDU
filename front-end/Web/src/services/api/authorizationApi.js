// Authorization (ms-authorization :8082). Roles, permisos, asignación.
import { request } from "../../api/apiClient";
import { endpoints } from "../../api/endpoints";

export const authorizationApi = {
    listRoles: () => request(endpoints.authorization.roles, { method: "GET" }),
    createRole: (b) => request(endpoints.authorization.roles, { method: "POST", body: b }),
    getRole: (id) => request(endpoints.authorization.roleById(id), { method: "GET" }),
    updateRole: (id, b) => request(endpoints.authorization.roleById(id), { method: "PUT", body: b }),
    deleteRole: (id) => request(endpoints.authorization.roleById(id), { method: "DELETE" }),
    listPermissions: () => request(endpoints.authorization.permissions, { method: "GET" }),
    createPermission: (b) => request(endpoints.authorization.permissions, { method: "POST", body: b }),
    rolePermissions: (roleId) =>
        request(endpoints.authorization.rolePermissions(roleId), { method: "GET" }),
    assignPermission: (roleId, permissionId) =>
        request(endpoints.authorization.rolePermissions(roleId), {
            method: "POST",
            body: { permissionId },
        }),
    removePermission: (roleId, permissionId) =>
        request(endpoints.authorization.rolePermission(roleId, permissionId), { method: "DELETE" }),
    userRoles: (userId) => request(endpoints.authorization.userRoles(userId), { method: "GET" }),
    assignRole: (userId, roleId) =>
        request(endpoints.authorization.userRoles(userId), { method: "POST", body: { roleId } }),
    removeRole: (userId, roleId) =>
        request(endpoints.authorization.userRole(userId, roleId), { method: "DELETE" }),
    evaluate: (params) =>
        request(endpoints.authorization.evaluate, { method: "GET", query: params }),
};
