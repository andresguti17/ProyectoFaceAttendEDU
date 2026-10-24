package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.adapter.out.messaging.DomainEventPublisher;
import com.faceattend_edu.identity_service.application.port.in.AuthenticateUserUseCase;
import com.faceattend_edu.identity_service.application.port.out.HashPasswordPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByIdentifierPort;
import com.faceattend_edu.identity_service.application.port.out.LoginAttemptPort;
import com.faceattend_edu.identity_service.application.port.out.SaveUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import com.faceattend_edu.identity_service.domain.exception.AccountLockedException;
import com.faceattend_edu.identity_service.domain.exception.TooManyLoginAttemptsException;
import com.faceattend_edu.identity_service.domain.exception.TwoFactorRequiredException;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@RequiredArgsConstructor
@Service
public class AuthenticateUserUseCaseImpl implements AuthenticateUserUseCase {

    private final LoadUserByIdentifierPort loadUserByIdentifierPort;
    private final SaveUserSessionPort saveUserSessionPort;
    private final UpdateUserPort updateUserPort;
    private final HashPasswordPort hashPasswordPort;
    private final LoginAttemptPort loginAttemptPort;
    private final AuthProperties authProperties;
    private final DomainEventPublisher eventPublisher;
    private final TwoFactorChallenge twoFactorChallenge;

    // '#' cannot appear in a username or e-mail, so IP keys never collide with identifiers.
    private static final String IP_KEY_PREFIX = "#ip:";

    @Override
    @Transactional
    public UserSession authenticate(String identifier, String password) {
        return authenticate(identifier, password, null);
    }

    @Override
    @Transactional
    public UserSession authenticate(String identifier, String password, String clientIp) {
        String ipKey = clientIp == null || clientIp.isBlank() ? null : IP_KEY_PREFIX + clientIp.trim();
        if (ipKey != null) {
            Duration blocked = loginAttemptPort.lockRemaining(ipKey);
            if (!blocked.isZero()) {
                throw new TooManyLoginAttemptsException(blocked);
            }
        }

        // A locked identifier is refused before any credential check, whether or not it exists:
        // the answer must not reveal which identifiers are real accounts.
        Duration locked = loginAttemptPort.lockRemaining(identifier);
        if (!locked.isZero()) {
            throw new AccountLockedException(locked);
        }

        User user = loadUserByIdentifierPort.loadUserByIdentifier(identifier);

        if (user == null || !user.isActive() || !hashPasswordPort.matches(password, user.getPasswordHash())) {
            if (ipKey != null) {
                loginAttemptPort.recordFailure(ipKey, authProperties.getMaxFailedLoginsPerIp(), authProperties.failedLoginIpWindow());
            }
            boolean nowLocked = loginAttemptPort.recordFailure(
                    identifier, authProperties.getMaxLoginAttempts(), authProperties.lockoutDuration());
            if (nowLocked) {
                if (user != null) {
                    eventPublisher.publish("identity-events", "{\"event\":\"UserLocked\",\"userId\":\"" + user.getUserId()
                            + "\",\"reason\":\"TOO_MANY_FAILED_LOGINS\",\"occurredAt\":\"" + Instant.now() + "\"}");
                }
                throw new AccountLockedException(authProperties.lockoutDuration());
            }
            throw new UnauthorizedException("Invalid email or password");
        }
        loginAttemptPort.reset(identifier);

        // Right password, but the account asked for a second factor: no session until the e-mailed
        // code is entered (POST /auth/login/verify). Last access is only touched on the real login.
        if (user.isTwoFactorEnabled()) {
            throw new TwoFactorRequiredException(twoFactorChallenge.begin(user));
        }

        user.touchLastAccess();
        updateUserPort.updateUser(user);

        UserSession session = new UserSession();
        session.setUserId(user);
        session.start();

        return saveUserSessionPort.saveUserSession(session);
    }
}
