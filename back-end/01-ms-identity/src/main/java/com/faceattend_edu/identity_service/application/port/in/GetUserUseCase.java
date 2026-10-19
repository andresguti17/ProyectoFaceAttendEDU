package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.User;
import java.util.UUID;

public interface GetUserUseCase {
    User getUser(UUID userId);
}
