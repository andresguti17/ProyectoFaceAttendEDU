package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;
import java.util.List;

public interface ListPasswordPoliciesUseCase {
    List<PasswordPolicy> listPolicies();
}
