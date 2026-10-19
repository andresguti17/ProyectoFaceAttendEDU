package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;

public interface LoadPasswordPolicyPort {
    PasswordPolicy loadPolicy(Integer policyId);
}
