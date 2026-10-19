package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;

public interface UpdatePasswordPolicyPort {
    void updatePolicy(PasswordPolicy policy);
}
