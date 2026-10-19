package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.User;
import java.util.UUID;

public interface LoadUserPort {
    User loadUser(UUID userId);
}
