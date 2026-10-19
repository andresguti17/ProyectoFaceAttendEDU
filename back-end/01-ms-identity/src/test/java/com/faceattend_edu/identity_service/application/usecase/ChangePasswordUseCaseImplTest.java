package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.adapter.out.messaging.DomainEventPublisher;
import com.faceattend_edu.identity_service.application.port.out.HashPasswordPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserSessionPort;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChangePasswordUseCaseImplTest {

    private User user;
    private User saved;
    private UserSession current;
    private UserSession other;
    private final List<UserSession> closed = new ArrayList<>();
    private ChangePasswordUseCaseImpl useCase;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername("aprendiz.faceattend");
        user.setPasswordHash("hash:Old1234!");
        user.setStatus(true);
        current = session();
        other = session();

        HashPasswordPort hash = new HashPasswordPort() {
            @Override
            public String hash(String rawPassword) {
                return "hash:" + rawPassword;
            }

            @Override
            public boolean matches(String rawPassword, String passwordHash) {
                return ("hash:" + rawPassword).equals(passwordHash);
            }
        };
        UpdateUserSessionPort sessionUpdate = new UpdateUserSessionPort() {
            @Override
            public void updateUserSession(UserSession session) {
                closed.add(session);
            }

            @Override
            public int closeSessionIfActive(UUID sessionId, LocalDateTime closedAt) {
                return 0;
            }
        };
        PasswordPolicy policy = new PasswordPolicy();
        policy.setMinLength(8);
        policy.setMaxLength(20);
        policy.setRequiresUppercase(true);
        policy.setRequiresNumbers(true);
        policy.setRequiresSymbols(true);

        useCase = new ChangePasswordUseCaseImpl(
                id -> user, u -> saved = u, hash, () -> List.of(policy),
                id -> List.of(current, other), sessionUpdate, new DomainEventPublisher(null));
    }

    private UserSession session() {
        UserSession session = new UserSession();
        session.setSessionId(UUID.randomUUID());
        session.setUserId(user);
        session.start();
        return session;
    }

    @Test
    void changesPasswordAndClosesOnlyTheOtherSessions() {
        useCase.changePassword(user.getUserId(), current.getSessionId(), "Old1234!", "New1234!");

        assertThat(saved.getPasswordHash()).isEqualTo("hash:New1234!");
        assertThat(current.isActive()).isTrue();
        assertThat(other.isActive()).isFalse();
        assertThat(closed).containsExactly(other);
    }

    @Test
    void rejectsAWrongCurrentPassword() {
        assertThatThrownBy(() -> useCase.changePassword(user.getUserId(), current.getSessionId(), "Nope1234!", "New1234!"))
                .isInstanceOf(ValidationException.class);
        assertThat(saved).isNull();
    }

    @Test
    void enforcesThePolicyAndRejectsReuse() {
        assertThatThrownBy(() -> useCase.changePassword(user.getUserId(), current.getSessionId(), "Old1234!", "weak"))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> useCase.changePassword(user.getUserId(), current.getSessionId(), "Old1234!", "Old1234!"))
                .isInstanceOf(ValidationException.class);
        assertThat(saved).isNull();
    }
}
