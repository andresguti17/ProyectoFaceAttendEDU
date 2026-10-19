package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.UserSession;
import java.util.List;
import java.util.UUID;

public interface LoadUserSessionsPort {
    List<UserSession> loadUserSessions(UUID userId);
}
