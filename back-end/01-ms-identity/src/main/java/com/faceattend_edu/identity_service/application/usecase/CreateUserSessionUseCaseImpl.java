package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.CreateUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.SaveUserSessionPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@RequiredArgsConstructor
@Service
public class CreateUserSessionUseCaseImpl implements CreateUserSessionUseCase {

    private final LoadUserPort loadUserPort;
    private final SaveUserSessionPort saveUserSessionPort;

    @Override
    public UserSession createSession(UUID userId, String sourceIp) {
        User user = loadUserPort.loadUser(userId);
        if (user == null) {
            throw new EntityNotFoundException("User", userId);
        }
        if (!user.isActive()) {
            throw new ValidationException("Cannot create session for inactive user");
        }
        
        UserSession session = new UserSession();
        session.setUserId(user);
        session.setSourceIp(sourceIp);
        session.start();
        
        return saveUserSessionPort.saveUserSession(session);
    }
}
