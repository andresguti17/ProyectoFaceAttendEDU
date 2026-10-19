package com.faceattend_edu.authorization_service.domain.port.in;

import com.faceattend_edu.authorization_service.domain.model.Role;

public interface UpdateRoleUseCase {
    Role updateRole(Integer roleId, String roleName, String description);
}
