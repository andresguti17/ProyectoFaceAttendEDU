package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.GetUserSessionsUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserSessionsPort;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@RequiredArgsConstructor
@Service
public class GetUserSessionsUseCaseImpl implements GetUserSessionsUseCase {

    private final LoadUserSessionsPort loadUserSessionsPort;

    @Override
    public List<UserSession> getUserSessions(UUID userId) {
        return loadUserSessionsPort.loadUserSessions(userId);
    }
}
