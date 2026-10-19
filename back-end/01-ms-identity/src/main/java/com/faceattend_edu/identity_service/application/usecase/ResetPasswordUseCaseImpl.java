package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.adapter.out.messaging.DomainEventPublisher;
import com.faceattend_edu.identity_service.application.port.in.ResetPasswordUseCase;
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
import com.faceattend_edu.identity_service.shared.util.Emails;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

@RequiredArgsConstructor
@Service
public class ResetPasswordUseCaseImpl implements ResetPasswordUseCase {

    private static final Logger log = LoggerFactory.getLogger(ResetPasswordUseCaseImpl.class);

    private final LoadUserByIdentifierPort loadUserByIdentifierPort;
    private final RecoveryCodePort recoveryCodePort;
    private final UpdateUserPort updateUserPort;
    private final HashPasswordPort hashPasswordPort;
    private final ListPasswordPoliciesPort listPasswordPoliciesPort;
    private final LoadUserSessionsPort loadUserSessionsPort;
    private final UpdateUserSessionPort updateUserSessionPort;
    private final DomainEventPublisher eventPublisher;

    @Override
    @Transactional
    public void resetPassword(String email, String rawPassword) {
        if (!Emails.isWellFormed(email)) {
            throw new ValidationException("A valid email is required");
        }
        String address = Emails.normalize(email);
        String password = rawPassword == null ? "" : rawPassword;
        if (password.isBlank()) {
            throw new ValidationException("Password is required");
        }

        // La política se valida ANTES de consumir el reto: una contraseña mal
        // formada no debe obligar al usuario a repetir todo el flujo.
        validateAgainstPolicy(password, listPasswordPoliciesPort.listPolicies());

        // Uso único: el reto se gasta aquí, y solo existe reto si /verify-code
        // lo marcó como verificado. Un reset sin verificar devuelve siempre 401,
        // exista o no la cuenta (sin enumeración).
        if (!recoveryCodePort.consumeVerified(address)) {
            throw new UnauthorizedException("Verification code required");
        }

        User user = loadUserByIdentifierPort.loadUserByIdentifier(address);
        if (user == null || !user.isActive()) {
            throw new UnauthorizedException("Verification code required");
        }

        user.setPasswordHash(hashPasswordPort.hash(password));
        user.setUpdatedAt(LocalDateTime.now());
        updateUserPort.updateUser(user);

        int closed = closeActiveSessions(user.getUserId());

        eventPublisher.publish("identity-events",
                "{\"type\":\"PasswordChanged\",\"userId\":\"" + user.getUserId()
                        + "\",\"occurredAt\":\"" + Instant.now() + "\"}");
        log.info("Password reset for userId={} activeSessionsClosed={}", user.getUserId(), closed);
    }

    /**
     * La política vigente es la autoridad (seed: 8-20, mayúsculas, números y
     * símbolos). Si no hay política cargada solo se exige longitud mínima.
     */
    static void validateAgainstPolicy(String password, List<PasswordPolicy> policies) {
        PasswordPolicy policy = policies.stream()
                .filter(p -> p != null)
                .findFirst()
                .orElse(null);

        if (policy == null) {
            if (password.length() < 8) {
                throw new ValidationException("Password must be at least 8 characters");
            }
            return;
        }

        int min = policy.getMinLength() != null ? policy.getMinLength() : 8;
        int max = policy.getMaxLength() != null ? policy.getMaxLength() : 128;
        if (password.length() < min || password.length() > max) {
            throw new ValidationException("Password must be between " + min + " and " + max + " characters");
        }
        if (Boolean.TRUE.equals(policy.getRequiresUppercase()) && !password.matches(".*[A-Z].*")) {
            throw new ValidationException("Password must contain an uppercase letter");
        }
        if (Boolean.TRUE.equals(policy.getRequiresNumbers()) && !password.matches(".*\\d.*")) {
            throw new ValidationException("Password must contain a number");
        }
        if (Boolean.TRUE.equals(policy.getRequiresSymbols()) && !password.matches(".*[^A-Za-z0-9].*")) {
            throw new ValidationException("Password must contain a symbol");
        }
    }

    /** Cambiar la credencial invalida todo lo que esté vivo del usuario. */
    private int closeActiveSessions(java.util.UUID userId) {
        List<UserSession> sessions = loadUserSessionsPort.loadUserSessions(userId);
        int closed = 0;
        for (UserSession session : sessions) {
            if (session.isActive()) {
                session.end();
                updateUserSessionPort.updateUserSession(session);
                closed++;
            }
        }
        return closed;
    }
}
