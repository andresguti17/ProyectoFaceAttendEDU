package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.UpdateUserUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@RequiredArgsConstructor
@Service
public class UpdateUserUseCaseImpl implements UpdateUserUseCase {

    private final UpdateUserPort updateUserPort;
    private final LoadUserPort loadUserPort;

    @Override
    @Transactional
    public void updateUser(User user) {
        User existing = loadUserPort.loadUser(user.getUserId());
        if (existing == null) {
            throw new EntityNotFoundException("User", user.getUserId());
        }

        // The credential is write-only: a partial update keeps the stored hash.
        if (user.getPasswordHash() == null) user.setPasswordHash(existing.getPasswordHash());
        if (user.getPersonId() == null) user.setPersonId(existing.getPersonId());
        if (user.getUsername() == null) user.setUsername(existing.getUsername());
        if (user.getAuthenticationType() == null) user.setAuthenticationType(existing.getAuthenticationType());
        if (user.getStatus() == null) user.setStatus(existing.getStatus());

        user.setCreatedAt(existing.getCreatedAt());
        user.validate();
        user.setUpdatedAt(LocalDateTime.now());
        updateUserPort.updateUser(user);
    }
}
