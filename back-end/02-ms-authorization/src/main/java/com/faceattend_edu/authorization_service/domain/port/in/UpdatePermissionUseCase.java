package com.faceattend_edu.authorization_service.domain.port.in;

import com.faceattend_edu.authorization_service.domain.model.Permission;

public interface UpdatePermissionUseCase {
    Permission updatePermission(Integer permissionId, String permissionName, String description);
}
