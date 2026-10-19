package com.faceattend_edu.authorization_service.domain.port.in;

import com.faceattend_edu.authorization_service.domain.model.Role;

public interface CreateRoleUseCase {
    Role createRole(String roleName, String description);
}
