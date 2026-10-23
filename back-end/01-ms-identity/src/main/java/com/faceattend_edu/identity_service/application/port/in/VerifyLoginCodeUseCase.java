package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.UserSession;

public interface VerifyLoginCodeUseCase {

    /**
     * Second step of a login with two-factor: the code e-mailed after the password check.
     *
     * @param identifier login email or username, the same one used in the first step
     * @throws com.faceattend_edu.identity_service.domain.exception.UnauthorizedException wrong, expired or exhausted code (401)
     * @throws com.faceattend_edu.identity_service.domain.exception.AccountLockedException too many failures (423)
     */
    UserSession verify(String identifier, String code);
}
