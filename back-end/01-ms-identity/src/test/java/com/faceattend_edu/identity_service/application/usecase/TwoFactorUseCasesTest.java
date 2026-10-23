package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.adapter.out.security.InMemoryLoginAttemptAdapter;
import com.faceattend_edu.identity_service.application.port.out.HashPasswordPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByIdentifierPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort;
import com.faceattend_edu.identity_service.application.port.out.SaveUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.SendLoginCodePort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import com.faceattend_edu.identity_service.domain.exception.AccountLockedException;
import com.faceattend_edu.identity_service.domain.exception.EmailDeliveryException;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The e-mailed second factor: the challenge, the second login step and turning it on and off. */
@ExtendWith(MockitoExtension.class)
class TwoFactorUseCasesTest {

    private static final String IDENTIFIER = "carolina";

    @Mock RecoveryCodePort codes;
    @Mock SendLoginCodePort sender;
    @Mock LoadUserByIdentifierPort loadByIdentifier;
    @Mock LoadUserPort loadUser;
    @Mock SaveUserSessionPort saveSession;
    @Mock UpdateUserPort updateUser;
    @Mock HashPasswordPort hasher;

    private AuthProperties properties;
    private TwoFactorChallenge challenge;
    private User user;

    @BeforeEach
    void setUp() {
        properties = new AuthProperties();
        challenge = new TwoFactorChallenge(codes, sender, properties);
        Person person = new Person();
        person.setName("Carolina");
        person.setEmail("carolina@example.com");
        user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername(IDENTIFIER);
        user.setPasswordHash("hash");
        user.setStatus(true);
        user.setPersonId(person);
        lenient().when(saveSession.saveUserSession(any(UserSession.class))).thenAnswer(call -> call.getArgument(0));
    }

    private RecoveryCodePort.IssuedCode issued() {
        return new RecoveryCodePort.IssuedCode("2fa:" + user.getUserId(), "123456", LocalDateTime.now().plusMinutes(10));
    }

    // ── challenge ────────────────────────────────────────────────────────────

    @Test
    void theCodeIsEmailedAndTheAddressComesBackMasked() {
        when(codes.issue(eq("2fa:" + user.getUserId()), any(Duration.class))).thenReturn(issued());
        when(sender.sendLoginCode(eq("carolina@example.com"), eq("Carolina"), eq("123456"), any(Duration.class))).thenReturn(true);

        assertThat(challenge.begin(user)).isEqualTo("c***@example.com");
    }

    @Test
    void insideTheResendCooldownNothingIsSentAgain() {
        when(codes.issue(anyString(), any(Duration.class))).thenReturn(null);

        assertThat(challenge.begin(user)).isEqualTo("c***@example.com");

        verify(sender, never()).sendLoginCode(anyString(), anyString(), anyString(), any(Duration.class));
    }

    @Test
    void anAccountWithoutAnEmailCannotUseTheSecondFactor() {
        user.getPersonId().setEmail(" ");

        assertThatThrownBy(() -> challenge.begin(user)).isInstanceOf(EmailDeliveryException.class);
        verify(codes, never()).issue(anyString(), any(Duration.class));
    }

    @Test
    void aFailedDeliveryIsReportedInsteadOfSilentlyLockingThePersonOut() {
        when(codes.issue(anyString(), any(Duration.class))).thenReturn(issued());
        when(sender.sendLoginCode(anyString(), anyString(), anyString(), any(Duration.class))).thenReturn(false);

        assertThatThrownBy(() -> challenge.begin(user)).isInstanceOf(EmailDeliveryException.class);
    }

    @Test
    void onlySixDigitsReachTheCodeStore() {
        assertThat(challenge.verify(user, "12ab56")).isFalse();
        assertThat(challenge.verify(user, null)).isFalse();

        verify(codes, never()).verify(anyString(), anyString());
    }

    @Test
    void aRightCodeIsSpentOnce() {
        when(codes.verify("2fa:" + user.getUserId(), "123456")).thenReturn(true);
        when(codes.consumeVerified("2fa:" + user.getUserId())).thenReturn(true);

        assertThat(challenge.verify(user, " 123456 ")).isTrue();
    }

    // ── second login step ────────────────────────────────────────────────────

    private VerifyLoginCodeUseCaseImpl verifier() {
        return new VerifyLoginCodeUseCaseImpl(loadByIdentifier, saveSession, updateUser, new InMemoryLoginAttemptAdapter(), challenge, properties);
    }

    @Test
    void theRightCodeOpensTheSession() {
        user.setTwoFactorEnabled(true);
        when(loadByIdentifier.loadUserByIdentifier(IDENTIFIER)).thenReturn(user);
        when(codes.verify(anyString(), eq("123456"))).thenReturn(true);
        when(codes.consumeVerified(anyString())).thenReturn(true);

        UserSession session = verifier().verify(IDENTIFIER, "123456");

        assertThat(session).isNotNull();
        verify(updateUser).updateUser(user);
    }

    @Test
    void aWrongCodeIsRefusedWithoutASession() {
        user.setTwoFactorEnabled(true);
        when(loadByIdentifier.loadUserByIdentifier(IDENTIFIER)).thenReturn(user);
        when(codes.verify(anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() -> verifier().verify(IDENTIFIER, "000000")).isInstanceOf(UnauthorizedException.class);

        verify(saveSession, never()).saveUserSession(any(UserSession.class));
    }

    @Test
    void anAccountWithoutTwoFactorCannotUseThisStep() {
        when(loadByIdentifier.loadUserByIdentifier(IDENTIFIER)).thenReturn(user);

        assertThatThrownBy(() -> verifier().verify(IDENTIFIER, "123456")).isInstanceOf(UnauthorizedException.class);

        verify(codes, never()).verify(anyString(), anyString());
    }

    @Test
    void anUnknownAccountGetsTheSameAnswerAsAWrongCode() {
        when(loadByIdentifier.loadUserByIdentifier("ghost")).thenReturn(null);

        assertThatThrownBy(() -> verifier().verify("ghost", "123456"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Invalid or expired code");
    }

    @Test
    void repeatedWrongCodesLockTheAccountLikeWrongPasswords() {
        user.setTwoFactorEnabled(true);
        when(loadByIdentifier.loadUserByIdentifier(IDENTIFIER)).thenReturn(user);
        when(codes.verify(anyString(), anyString())).thenReturn(false);
        VerifyLoginCodeUseCaseImpl verifier = verifier();

        for (int i = 0; i < properties.getMaxLoginAttempts() - 1; i++) {
            assertThatThrownBy(() -> verifier.verify(IDENTIFIER, "000000")).isInstanceOf(UnauthorizedException.class);
        }
        assertThatThrownBy(() -> verifier.verify(IDENTIFIER, "000000")).isInstanceOf(AccountLockedException.class);
        assertThatThrownBy(() -> verifier.verify(IDENTIFIER, "123456")).isInstanceOf(AccountLockedException.class);
    }

    // ── turning it on and off ────────────────────────────────────────────────

    private ManageTwoFactorUseCaseImpl manager() {
        return new ManageTwoFactorUseCaseImpl(loadUser, updateUser, hasher, challenge);
    }

    @Test
    void enablingNeedsThePasswordAndEmailsACodeButChangesNothingYet() {
        when(loadUser.loadUser(user.getUserId())).thenReturn(user);
        when(hasher.matches("secret", "hash")).thenReturn(true);
        when(codes.issue(anyString(), any(Duration.class))).thenReturn(issued());
        when(sender.sendLoginCode(anyString(), anyString(), anyString(), any(Duration.class))).thenReturn(true);

        assertThat(manager().requestEnable(user.getUserId(), "secret")).isEqualTo("c***@example.com");

        assertThat(user.isTwoFactorEnabled()).isFalse();
        verify(updateUser, never()).updateUser(any(User.class));
    }

    @Test
    void enablingWithAWrongPasswordIsRefused() {
        when(loadUser.loadUser(user.getUserId())).thenReturn(user);
        when(hasher.matches("bad", "hash")).thenReturn(false);

        assertThatThrownBy(() -> manager().requestEnable(user.getUserId(), "bad")).isInstanceOf(ValidationException.class);

        verify(codes, never()).issue(anyString(), any(Duration.class));
    }

    @Test
    void theRightCodeTurnsTheSecondFactorOn() {
        when(loadUser.loadUser(user.getUserId())).thenReturn(user);
        when(codes.verify(anyString(), eq("123456"))).thenReturn(true);
        when(codes.consumeVerified(anyString())).thenReturn(true);

        manager().confirmEnable(user.getUserId(), "123456");

        assertThat(user.isTwoFactorEnabled()).isTrue();
        verify(updateUser).updateUser(user);
    }

    @Test
    void aWrongCodeLeavesTheSecondFactorOff() {
        when(loadUser.loadUser(user.getUserId())).thenReturn(user);
        when(codes.verify(anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() -> manager().confirmEnable(user.getUserId(), "000000")).isInstanceOf(UnauthorizedException.class);

        assertThat(user.isTwoFactorEnabled()).isFalse();
        verify(updateUser, never()).updateUser(any(User.class));
    }

    @Test
    void disablingNeedsThePassword() {
        user.setTwoFactorEnabled(true);
        when(loadUser.loadUser(user.getUserId())).thenReturn(user);
        when(hasher.matches("bad", "hash")).thenReturn(false);
        when(hasher.matches("secret", "hash")).thenReturn(true);

        assertThatThrownBy(() -> manager().disable(user.getUserId(), "bad")).isInstanceOf(ValidationException.class);
        assertThat(user.isTwoFactorEnabled()).isTrue();

        manager().disable(user.getUserId(), "secret");

        assertThat(user.isTwoFactorEnabled()).isFalse();
        verify(updateUser).updateUser(user);
    }
}
