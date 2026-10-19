package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.User;

public interface UpdateUserPort {
    void updateUser(User user);
}
