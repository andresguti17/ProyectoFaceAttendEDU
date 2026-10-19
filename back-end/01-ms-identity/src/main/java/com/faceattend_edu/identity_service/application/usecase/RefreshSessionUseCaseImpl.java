package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.RefreshSessionUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.SaveUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserSessionPort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@RequiredArgsConstructor
@Service
public class RefreshSessionUseCaseImpl implements RefreshSessionUseCase {

    private static final Logger log = LoggerFactory.getLogger(RefreshSessionUseCaseImpl.class);

    private final LoadUserSessionPort loadUserSessionPort;
    private final UpdateUserSessionPort updateUserSessionPort;
    private final SaveUserSessionPort saveUserSessionPort;
    private final AuthProperties authProperties;

    @Override
    @Transactional
    public UserSession refresh(UUID sessionId, String sourceIp) {
        UserSession current = loadUserSessionPort.loadUserSession(sessionId);
        if (current == null || current.getSessionId() == null) {
            throw new UnauthorizedException("Invalid session");
        }
        if (!current.isActive()) {
            throw new UnauthorizedException("Session is closed");
        }
        if (current.isExpired(authProperties.sessionTimeout())) {
            current.end();
            updateUserSessionPort.updateUserSession(current);
            log.info("Session expired on refresh sessionId={}", sessionId);
            throw new UnauthorizedException("Session expired");
        }

        // Un solo ganador: quien cierra la sesión Active es quien emite la nueva.
        if (updateUserSessionPort.closeSessionIfActive(sessionId, LocalDateTime.now()) != 1) {
            log.info("Session already rotated sessionId={}", sessionId);
            throw new UnauthorizedException("Session already refreshed");
        }

        UserSession next = new UserSession();
        next.setUserId(current.getUserId());
        next.setSourceIp(sourceIp);
        next.start();

        UserSession saved = saveUserSessionPort.saveUserSession(next);
        log.info("Session refreshed oldSessionId={} newSessionId={}", sessionId, saved.getSessionId());
        return saved;
    }
}
