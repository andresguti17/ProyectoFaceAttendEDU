package com.faceattend_edu.identity_service.application.port.in;

import java.util.UUID;

public interface ActivateUserUseCase {
    void activateUser(UUID userId);
}
