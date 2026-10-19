package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.UserSession;
import java.util.UUID;

public interface CreateUserSessionUseCase {
    UserSession createSession(UUID userId, String sourceIp);
}
