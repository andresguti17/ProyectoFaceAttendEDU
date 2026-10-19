package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.User;

public interface LoadUserByUsernamePort {
    User loadUserByUsername(String username);
}
