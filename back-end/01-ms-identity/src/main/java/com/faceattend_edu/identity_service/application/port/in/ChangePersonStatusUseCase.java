package com.faceattend_edu.identity_service.application.port.in;

import java.util.UUID;

public interface ChangePersonStatusUseCase {
    void changeStatus(UUID personId, boolean status);
}
