package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.UserSession;

import java.util.List;

public interface ListUserSessionsPort {

    List<UserSession> listUserSessions();
}
