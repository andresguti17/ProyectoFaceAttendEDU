package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.GetUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserSessionPort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@RequiredArgsConstructor
@Service
public class GetUserSessionUseCaseImpl implements GetUserSessionUseCase {

    private final LoadUserSessionPort loadUserSessionPort;
    private final UpdateUserSessionPort updateUserSessionPort;
    private final AuthProperties authProperties;

    @Override
    @Transactional
    public UserSession getUserSession(UUID sessionId) {
        UserSession session = loadUserSessionPort.loadUserSession(sessionId);
        if (session == null) {
            throw new EntityNotFoundException("UserSession", sessionId);
        }
        // Expiración perezosa en la ruta de lectura: TODOS los microservicios
        // validan su bearer contra este GET, así que una sesión vencida pasa a
        // "Closed" aquí y queda rechazada en toda la plataforma sin tocar los
        // AuthTokenFilter duplicados de los demás MS.
        if (session.isActive() && session.isExpired(authProperties.sessionTimeout())) {
            session.end();
            updateUserSessionPort.updateUserSession(session);
        }
        return session;
    }
}
