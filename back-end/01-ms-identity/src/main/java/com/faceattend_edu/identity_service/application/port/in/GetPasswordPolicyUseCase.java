package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;

public interface GetPasswordPolicyUseCase {
    PasswordPolicy getPolicy(Integer policyId);
}
