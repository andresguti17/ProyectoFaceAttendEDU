package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.UserSession;

public interface AuthenticateUserUseCase {
    /** @param identifier login email or username */
    UserSession authenticate(String identifier, String password);
}
