package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.adapter.out.messaging.DomainEventPublisher;
import com.faceattend_edu.identity_service.adapter.out.security.InMemoryLoginAttemptAdapter;
import com.faceattend_edu.identity_service.application.port.out.HashPasswordPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByIdentifierPort;
import com.faceattend_edu.identity_service.application.port.out.SaveUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import com.faceattend_edu.identity_service.domain.exception.AccountLockedException;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Login with the temporary lock: 5 failures lock the identifier for 30 minutes. */
@ExtendWith(MockitoExtension.class)
class AuthenticateUserUseCaseImplTest {

    private static final String IDENTIFIER = "Carolina@Example.com";

    @Mock LoadUserByIdentifierPort loadUser;
    @Mock SaveUserSessionPort saveSession;
    @Mock UpdateUserPort updateUser;
    @Mock HashPasswordPort hasher;
    @Mock DomainEventPublisher eventPublisher;
    @Mock TwoFactorChallenge twoFactorChallenge;

    private AuthProperties properties;
    private AuthenticateUserUseCaseImpl useCase;

    @BeforeEach
    void setUp() {
        properties = new AuthProperties();
        useCase = new AuthenticateUserUseCaseImpl(
                loadUser, saveSession, updateUser, hasher, new InMemoryLoginAttemptAdapter(), properties, eventPublisher, twoFactorChallenge);
        lenient().when(saveSession.saveUserSession(any(UserSession.class))).thenAnswer(call -> call.getArgument(0));
    }

    private User activeUser() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername("carolina");
        user.setPasswordHash("hash");
        user.setStatus(true);
        return user;
    }

    private void wrongPassword(User user) {
        when(loadUser.loadUserByIdentifier(IDENTIFIER)).thenReturn(user);
        when(hasher.matches(any(), any())).thenReturn(false);
    }

    @Test
    void anAccountWithTwoFactorGetsACodeInsteadOfASession() {
        User user = activeUser();
        user.setTwoFactorEnabled(true);
        when(loadUser.loadUserByIdentifier(IDENTIFIER)).thenReturn(user);
        when(hasher.matches("secret", "hash")).thenReturn(true);
        when(twoFactorChallenge.begin(user)).thenReturn("c***@example.com");

        assertThatThrownBy(() -> useCase.authenticate(IDENTIFIER, "secret"))
                .isInstanceOf(com.faceattend_edu.identity_service.domain.exception.TwoFactorRequiredException.class)
                .hasFieldOrPropertyWithValue("maskedEmail", "c***@example.com");

        org.mockito.Mockito.verify(saveSession, org.mockito.Mockito.never()).saveUserSession(any(UserSession.class));
    }

    @Test
    void aWrongPasswordNeverSendsACode() {
        User user = activeUser();
        user.setTwoFactorEnabled(true);
        wrongPassword(user);

        assertThatThrownBy(() -> useCase.authenticate(IDENTIFIER, "bad")).isInstanceOf(UnauthorizedException.class);

        org.mockito.Mockito.verifyNoInteractions(twoFactorChallenge);
    }

    @Test
    void aValidLoginStartsASession() {
        User user = activeUser();
        when(loadUser.loadUserByIdentifier(IDENTIFIER)).thenReturn(user);
        when(hasher.matches("secret", "hash")).thenReturn(true);

        assertThat(useCase.authenticate(IDENTIFIER, "secret")).isNotNull();
    }

    @Test
    void failuresBelowTheLimitAreOrdinaryUnauthorized() {
        wrongPassword(activeUser());

        for (int i = 0; i < properties.getMaxLoginAttempts() - 1; i++) {
            assertThatThrownBy(() -> useCase.authenticate(IDENTIFIER, "bad")).isInstanceOf(UnauthorizedException.class);
        }
    }

    @Test
    void theFailureThatReachesTheLimitLocksTheAccountAndPublishesTheEvent() {
        wrongPassword(activeUser());
        for (int i = 0; i < properties.getMaxLoginAttempts() - 1; i++) {
            assertThatThrownBy(() -> useCase.authenticate(IDENTIFIER, "bad")).isInstanceOf(UnauthorizedException.class);
        }

        assertThatThrownBy(() -> useCase.authenticate(IDENTIFIER, "bad"))
                .isInstanceOfSatisfying(AccountLockedException.class,
                        ex -> assertThat(ex.getRetryAfter()).isEqualTo(properties.lockoutDuration()));
        verify(eventPublisher).publish(eq("identity-events"), any(String.class));
    }

    @Test
    void aLockedAccountIsRefusedEvenWithTheRightPassword() {
        User user = activeUser();
        wrongPassword(user);
        for (int i = 0; i < properties.getMaxLoginAttempts(); i++) {
            try { useCase.authenticate(IDENTIFIER, "bad"); } catch (RuntimeException ignored) { }
        }

        assertThatThrownBy(() -> useCase.authenticate("carolina@example.com", "secret"))
                .isInstanceOf(AccountLockedException.class);
        verify(saveSession, never()).saveUserSession(any());
    }

    @Test
    void anUnknownIdentifierIsLockedToo_withoutRevealingItDoesNotExist() {
        when(loadUser.loadUserByIdentifier("ghost@example.com")).thenReturn(null);

        for (int i = 0; i < properties.getMaxLoginAttempts() - 1; i++) {
            assertThatThrownBy(() -> useCase.authenticate("ghost@example.com", "x")).isInstanceOf(UnauthorizedException.class);
        }
        assertThatThrownBy(() -> useCase.authenticate("ghost@example.com", "x")).isInstanceOf(AccountLockedException.class);
        verify(eventPublisher, never()).publish(any(), any());
    }

    @Test
    void aSuccessfulLoginClearsThePreviousFailures() {
        User user = activeUser();
        when(loadUser.loadUserByIdentifier(IDENTIFIER)).thenReturn(user);
        when(hasher.matches("bad", "hash")).thenReturn(false);
        when(hasher.matches("secret", "hash")).thenReturn(true);

        for (int i = 0; i < properties.getMaxLoginAttempts() - 1; i++) {
            assertThatThrownBy(() -> useCase.authenticate(IDENTIFIER, "bad")).isInstanceOf(UnauthorizedException.class);
        }
        useCase.authenticate(IDENTIFIER, "secret");

        // The counter restarted: another run of failures below the limit does not lock.
        for (int i = 0; i < properties.getMaxLoginAttempts() - 1; i++) {
            assertThatThrownBy(() -> useCase.authenticate(IDENTIFIER, "bad")).isInstanceOf(UnauthorizedException.class);
        }
    }
}
