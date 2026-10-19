package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;
import java.util.List;

public interface ListPasswordPoliciesPort {
    List<PasswordPolicy> listPolicies();
}
