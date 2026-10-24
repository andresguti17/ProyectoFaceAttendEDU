package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.UserSession;

public interface AuthenticateUserUseCase {
    /** @param identifier login email or username */
    UserSession authenticate(String identifier, String password);

    /** Same login, also counting failures per client IP (10 per minute, then HTTP 429). */
    UserSession authenticate(String identifier, String password, String clientIp);
}
