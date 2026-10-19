package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.User;

public interface CreateUserUseCase {

    /**
     * @param user        aggregate carrying personId, username and authenticationType
     * @param rawPassword plaintext credential, hashed before it reaches the domain
     */
    User createUser(User user, String rawPassword);
}
