package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.CreatePasswordPolicyUseCase;
import com.faceattend_edu.identity_service.application.port.out.SavePasswordPolicyPort;
import com.faceattend_edu.identity_service.adapter.out.messaging.DomainEventPublisher;
import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class CreatePasswordPolicyUseCaseImpl implements CreatePasswordPolicyUseCase {

    private final SavePasswordPolicyPort savePasswordPolicyPort;
    private final DomainEventPublisher eventPublisher;

    @Override
    public PasswordPolicy createPolicy(PasswordPolicy policy) {
        policy.validate();
        policy.setCreatedAt(LocalDateTime.now());
        PasswordPolicy saved = savePasswordPolicyPort.savePolicy(policy);
        eventPublisher.publish("password-policy-events", "{\"policyId\":" + saved.getPolicyId() + "}");
        return saved;
    }
}
