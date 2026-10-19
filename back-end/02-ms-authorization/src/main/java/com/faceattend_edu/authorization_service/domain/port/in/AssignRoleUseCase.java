package com.faceattend_edu.authorization_service.domain.port.in;
import java.util.UUID;
public interface AssignRoleUseCase {
    void assign(UUID userId, Integer roleId);
}
