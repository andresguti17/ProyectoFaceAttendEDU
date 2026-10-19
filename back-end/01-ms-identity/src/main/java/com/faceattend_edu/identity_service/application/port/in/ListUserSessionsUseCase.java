package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.UserSession;

import java.util.List;

public interface ListUserSessionsUseCase {

    List<UserSession> listUserSessions();
}
