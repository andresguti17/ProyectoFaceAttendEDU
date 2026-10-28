package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.CloseUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserSessionPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@RequiredArgsConstructor
@Service
public class CloseUserSessionUseCaseImpl implements CloseUserSessionUseCase {

    private final LoadUserSessionPort loadUserSessionPort;
    private final UpdateUserSessionPort updateUserSessionPort;

    @Override
    public void closeSession(UUID sessionId) {
        UserSession session = loadUserSessionPort.loadUserSession(sessionId);
        if (session == null) {
            // Administración cierra por el id que listan las rutas de sesiones, que no es el token.
            session = loadUserSessionPort.loadUserSessionByStoredId(sessionId);
        }
        if (session == null) {
            throw new EntityNotFoundException("UserSession", sessionId);
        }
        session.end();
        updateUserSessionPort.updateUserSession(session);
    }
}
