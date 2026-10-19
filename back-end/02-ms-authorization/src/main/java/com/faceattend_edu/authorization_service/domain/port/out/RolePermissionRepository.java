package com.faceattend_edu.authorization_service.domain.port.out;

import com.faceattend_edu.authorization_service.domain.model.RolePermission;
import com.faceattend_edu.authorization_service.domain.model.Permission;

import java.util.List;

public interface RolePermissionRepository {
    RolePermission save(RolePermission rolePermission);
    void delete(Integer roleId, Integer permissionId);
    boolean exists(Integer roleId, Integer permissionId);
    List<Permission> findPermissionsByRoleId(Integer roleId);
    List<RolePermission> findByRoleId(Integer roleId);
}
