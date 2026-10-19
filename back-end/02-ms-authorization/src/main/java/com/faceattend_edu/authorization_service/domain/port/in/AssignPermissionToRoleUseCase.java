package com.faceattend_edu.authorization_service.domain.port.in;

public interface AssignPermissionToRoleUseCase {
    void assignPermissionToRole(Integer roleId, Integer permissionId);
    void removePermissionFromRole(Integer roleId, Integer permissionId);
}
