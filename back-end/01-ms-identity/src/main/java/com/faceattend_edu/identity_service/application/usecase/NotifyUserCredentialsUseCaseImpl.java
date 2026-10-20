package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.NotifyUserCredentialsUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.SendCredentialsEmailPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Best effort: the account already exists, so a failed email never undoes it.
 * The forced password change is only set once the email was accepted, because
 * only then did the person receive the initial password.
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class NotifyUserCredentialsUseCaseImpl implements NotifyUserCredentialsUseCase {

    private final LoadUserPort loadUserPort;
    private final LoadPersonPort loadPersonPort;
    private final UpdateUserPort updateUserPort;
    private final SendCredentialsEmailPort sendCredentialsEmailPort;

    @Override
    public Status notifyCredentials(UUID userId, String rawPassword) {
        User user = loadUserPort.loadUser(userId);
        if (user == null) {
            throw new EntityNotFoundException("User", userId);
        }
        // The person is read on its own: within the request that just created the
        // account, the user loaded above still carries the id-only reference the
        // create flow built, without the email.
        Person person = user.getPersonId() != null && user.getPersonId().getPersonId() != null
                ? loadPersonPort.loadPerson(user.getPersonId().getPersonId())
                : null;
        String email = person != null ? person.getEmail() : null;
        if (email == null || email.isBlank() || !user.isActive()) {
            return Status.SKIPPED;
        }

        boolean sent = sendCredentialsEmailPort.sendCredentials(
                email.trim(), person.getFullName(), user.getUsername(), rawPassword);
        if (!sent) {
            log.warn("Credentials email not delivered for user={}", userId);
            return Status.FAILED;
        }

        user.setMustChangePassword(true);
        user.setUpdatedAt(LocalDateTime.now());
        updateUserPort.updateUser(user);
        return Status.SENT;
    }
}
