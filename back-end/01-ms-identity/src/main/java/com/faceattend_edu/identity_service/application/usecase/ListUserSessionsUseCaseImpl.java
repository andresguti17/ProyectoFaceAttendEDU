package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ListUserSessionsUseCase;
import com.faceattend_edu.identity_service.application.port.out.ListUserSessionsPort;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@RequiredArgsConstructor
@Service
public class ListUserSessionsUseCaseImpl implements ListUserSessionsUseCase {

    private final ListUserSessionsPort listUserSessionsPort;

    @Override
    public List<UserSession> listUserSessions() {
        return listUserSessionsPort.listUserSessions();
    }
}
