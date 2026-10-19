package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.UpdatePasswordPolicyUseCase;
import com.faceattend_edu.identity_service.application.port.out.UpdatePasswordPolicyPort;
import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UpdatePasswordPolicyUseCaseImpl implements UpdatePasswordPolicyUseCase {

    private final UpdatePasswordPolicyPort updatePasswordPolicyPort;

    @Override
    public void updatePolicy(PasswordPolicy policy) {
        policy.validate();
        policy.setUpdatedAt(LocalDateTime.now());
        updatePasswordPolicyPort.updatePolicy(policy);
    }
}
