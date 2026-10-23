package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.VerifyLoginCodeUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByIdentifierPort;
import com.faceattend_edu.identity_service.application.port.out.LoginAttemptPort;
import com.faceattend_edu.identity_service.application.port.out.SaveUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import com.faceattend_edu.identity_service.domain.exception.AccountLockedException;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;

@RequiredArgsConstructor
@Service
public class VerifyLoginCodeUseCaseImpl implements VerifyLoginCodeUseCase {

    private final LoadUserByIdentifierPort loadUserByIdentifierPort;
    private final SaveUserSessionPort saveUserSessionPort;
    private final UpdateUserPort updateUserPort;
    private final LoginAttemptPort loginAttemptPort;
    private final TwoFactorChallenge challenge;
    private final AuthProperties authProperties;

    @Override
    @Transactional
    public UserSession verify(String identifier, String code) {
        Duration locked = loginAttemptPort.lockRemaining(identifier);
        if (!locked.isZero()) {
            throw new AccountLockedException(locked);
        }

        User user = loadUserByIdentifierPort.loadUserByIdentifier(identifier);
        // One answer for every failure (unknown account, no second factor, wrong or expired code),
        // and failures count toward the same lock as wrong passwords.
        if (user == null || !user.isActive() || !user.isTwoFactorEnabled() || !challenge.verify(user, code)) {
            if (loginAttemptPort.recordFailure(identifier, authProperties.getMaxLoginAttempts(), authProperties.lockoutDuration())) {
                throw new AccountLockedException(authProperties.lockoutDuration());
            }
            throw new UnauthorizedException("Invalid or expired code");
        }
        loginAttemptPort.reset(identifier);

        user.touchLastAccess();
        updateUserPort.updateUser(user);

        UserSession session = new UserSession();
        session.setUserId(user);
        session.start();
        return saveUserSessionPort.saveUserSession(session);
    }
}
