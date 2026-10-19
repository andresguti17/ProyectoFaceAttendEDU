package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.User;

public interface GetUserByUsernameUseCase {

    /** @param username username or person email */
    User getUserByUsername(String username);
}
