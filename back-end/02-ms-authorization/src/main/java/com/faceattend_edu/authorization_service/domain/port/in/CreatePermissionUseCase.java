package com.faceattend_edu.authorization_service.domain.port.in;

import com.faceattend_edu.authorization_service.domain.model.Permission;

public interface CreatePermissionUseCase {
    Permission createPermission(String permissionName, String description);
}
