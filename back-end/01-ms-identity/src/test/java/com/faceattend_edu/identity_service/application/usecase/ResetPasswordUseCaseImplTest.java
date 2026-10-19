package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.adapter.out.messaging.DomainEventPublisher;
import com.faceattend_edu.identity_service.application.port.out.HashPasswordPort;
import com.faceattend_edu.identity_service.application.port.out.ListPasswordPoliciesPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByIdentifierPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserSessionsPort;
import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserSessionPort;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * IEEE 829 - recuperación de contraseña: el reto verificado es la única
 * autorización y la política vigente manda sobre la contraseña nueva.
 */
class ResetPasswordUseCaseImplTest {

    private static final String EMAIL = "carolina.mendoza@example.com";

    private FakeUserLookup userLookup;
    private FakeRecoveryCodes recoveryCodes;
    private FakeUserUpdate userUpdate;
    private FakeSessionUpdate sessionUpdate;
    private FakeSessions sessions;
    private ResetPasswordUseCaseImpl useCase;

    @BeforeEach
    void setUp() {
        userLookup = new FakeUserLookup();
        recoveryCodes = new FakeRecoveryCodes();
        userUpdate = new FakeUserUpdate();
        sessionUpdate = new FakeSessionUpdate();
        sessions = new FakeSessions();
        useCase = new ResetPasswordUseCaseImpl(
                userLookup, recoveryCodes, userUpdate, new FakePasswordHash(),
                new FakePolicies(), sessions, sessionUpdate, new DomainEventPublisher(null));
    }

    @Test
    void resetsPasswordClosesSessionsAndConsumesTheChallenge() {
        User user = activeUser();
        userLookup.user = user;
        recoveryCodes.verified = true;
        UserSession open = openSession(user);
        sessions.sessions = List.of(open);

        useCase.resetPassword(EMAIL, "Secret1!");

        assertThat(userUpdate.updated.getPasswordHash()).isEqualTo("hash:Secret1!");
        assertThat(recoveryCodes.consumeCalls).isEqualTo(1);
        assertThat(open.getSessionStatus()).isEqualTo(UserSession.STATUS_CLOSED);
        assertThat(sessionUpdate.updateCalls).isEqualTo(1);
    }

    @Test
    void rejectsWhenThereIsNoVerifiedChallenge() {
        userLookup.user = activeUser();
        recoveryCodes.verified = false;

        assertThatThrownBy(() -> useCase.resetPassword(EMAIL, "Secret1!"))
                .isInstanceOf(UnauthorizedException.class);

        assertThat(recoveryCodes.consumeCalls).isEqualTo(1);
        assertThat(userUpdate.updated).isNull();
    }

    @Test
    void rejectsPasswordThatViolatesPolicyWithoutBurningTheChallenge() {
        userLookup.user = activeUser();
        recoveryCodes.verified = true;

        // Sin mayúscula: la política (8-20, mayúsculas, números, símbolos) la rechaza.
        assertThatThrownBy(() -> useCase.resetPassword(EMAIL, "secret1!"))
                .isInstanceOf(ValidationException.class);

        assertThat(recoveryCodes.consumeCalls).isZero();
        assertThat(userUpdate.updated).isNull();
    }

    @Test
    void rejectsMalformedEmailAndBlankPassword() {
        assertThatThrownBy(() -> useCase.resetPassword("not-an-email", "Secret1!"))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> useCase.resetPassword(EMAIL, "   "))
                .isInstanceOf(ValidationException.class);
    }

    private User activeUser() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername("carolina.mendoza");
        user.setPasswordHash("hash:old");
        user.setStatus(true);
        return user;
    }

    private UserSession openSession(User user) {
        UserSession session = new UserSession();
        session.setSessionId(UUID.randomUUID());
        session.setUserId(user);
        session.start();
        return session;
    }

    private static final class FakeUserLookup implements LoadUserByIdentifierPort {
        private User user;

        @Override
        public User loadUserByIdentifier(String identifier) {
            return user;
        }
    }

    private static final class FakeRecoveryCodes implements RecoveryCodePort {
        private boolean verified;
        private int consumeCalls;

        @Override
        public IssuedCode issue(String email, Duration ttl) {
            return null;
        }

        @Override
        public boolean verify(String email, String code) {
            return verified;
        }

        @Override
        public boolean consumeVerified(String email) {
            consumeCalls++;
            return verified;
        }
    }

    private static final class FakeUserUpdate implements UpdateUserPort {
        private User updated;

        @Override
        public void updateUser(User user) {
            updated = user;
        }
    }

    private static final class FakePasswordHash implements HashPasswordPort {
        @Override
        public String hash(String rawPassword) {
            return "hash:" + rawPassword;
        }

        @Override
        public boolean matches(String rawPassword, String passwordHash) {
            return ("hash:" + rawPassword).equals(passwordHash);
        }
    }

    private static final class FakePolicies implements ListPasswordPoliciesPort {
        @Override
        public List<PasswordPolicy> listPolicies() {
            PasswordPolicy policy = new PasswordPolicy();
            policy.setPolicyId(1);
            policy.setMinLength(8);
            policy.setMaxLength(20);
            policy.setRequiresUppercase(true);
            policy.setRequiresNumbers(true);
            policy.setRequiresSymbols(true);
            policy.setExpirationDays(90);
            return List.of(policy);
        }
    }

    private static final class FakeSessions implements LoadUserSessionsPort {
        private List<UserSession> sessions = List.of();

        @Override
        public List<UserSession> loadUserSessions(UUID userId) {
            return sessions;
        }
    }

    private static final class FakeSessionUpdate implements UpdateUserSessionPort {
        private int updateCalls;

        @Override
        public void updateUserSession(UserSession session) {
            updateCalls++;
        }

        @Override
        public int closeSessionIfActive(UUID sessionId, LocalDateTime closedAt) {
            return 0;
        }
    }
}
