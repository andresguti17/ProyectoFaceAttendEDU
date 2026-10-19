package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ActivateUserUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.service.UserActivationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@RequiredArgsConstructor
@Service
public class ActivateUserUseCaseImpl implements ActivateUserUseCase {

    private final LoadUserPort loadUserPort;
    private final UpdateUserPort updateUserPort;
    private final UserActivationService userActivationService;

    @Override
    public void activateUser(UUID userId) {
        User user = loadUserPort.loadUser(userId);
        if (user == null) {
            throw new EntityNotFoundException("User", userId);
        }
        userActivationService.activateUser(user);
        updateUserPort.updateUser(user);
    }
}
