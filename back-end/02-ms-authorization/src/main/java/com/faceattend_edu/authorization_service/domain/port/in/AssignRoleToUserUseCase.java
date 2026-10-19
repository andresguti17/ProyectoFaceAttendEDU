package com.faceattend_edu.authorization_service.domain.port.in;

import java.util.UUID;

public interface AssignRoleToUserUseCase {
    void assignRoleToUser(UUID userId, Integer roleId);
    void removeRoleFromUser(UUID userId, Integer roleId);
}
