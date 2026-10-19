package com.faceattend_edu.authorization_service.domain.port.in;

import java.util.UUID;

public interface CheckPermissionUseCase {
    boolean hasPermission(UUID userId, String permissionName);
}
