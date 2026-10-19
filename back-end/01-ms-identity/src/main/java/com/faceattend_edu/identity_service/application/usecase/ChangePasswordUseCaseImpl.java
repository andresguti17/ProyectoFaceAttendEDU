package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.adapter.out.messaging.DomainEventPublisher;
import com.faceattend_edu.identity_service.application.port.in.ChangePasswordUseCase;
import com.faceattend_edu.identity_service.application.port.out.HashPasswordPort;
import com.faceattend_edu.identity_service.application.port.out.ListPasswordPoliciesPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserSessionsPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserSessionPort;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@RequiredArgsConstructor
@Service
public class ChangePasswordUseCaseImpl implements ChangePasswordUseCase {

    private final LoadUserPort loadUserPort;
    private final UpdateUserPort updateUserPort;
    private final HashPasswordPort hashPasswordPort;
    private final ListPasswordPoliciesPort listPasswordPoliciesPort;
    private final LoadUserSessionsPort loadUserSessionsPort;
    private final UpdateUserSessionPort updateUserSessionPort;
    private final DomainEventPublisher eventPublisher;

    @Override
    @Transactional
    public void changePassword(UUID userId, UUID currentSessionId, String currentPassword, String newPassword) {
        User user = loadUserPort.loadUser(userId);
        if (user == null || !user.isActive() || currentPassword == null
                || !hashPasswordPort.matches(currentPassword, user.getPasswordHash())) {
            throw new ValidationException("Current password is incorrect");
        }
        String password = newPassword == null ? "" : newPassword;
        if (hashPasswordPort.matches(password, user.getPasswordHash())) {
            throw new ValidationException("The new password must be different from the current one");
        }
        ResetPasswordUseCaseImpl.validateAgainstPolicy(password, listPasswordPoliciesPort.listPolicies());

        user.setPasswordHash(hashPasswordPort.hash(password));
        user.setUpdatedAt(LocalDateTime.now());
        updateUserPort.updateUser(user);

        // Las demás sesiones pudieron abrirse con la credencial vieja: se cierran.
        for (UserSession session : loadUserSessionsPort.loadUserSessions(userId)) {
            if (session.isActive() && !session.getSessionId().equals(currentSessionId)) {
                session.end();
                updateUserSessionPort.updateUserSession(session);
            }
        }
        eventPublisher.publish("identity-events",
                "{\"type\":\"PasswordChanged\",\"userId\":\"" + userId + "\",\"occurredAt\":\"" + Instant.now() + "\"}");
    }
}
