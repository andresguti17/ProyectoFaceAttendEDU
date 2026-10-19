package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ListPasswordPoliciesUseCase;
import com.faceattend_edu.identity_service.application.port.out.ListPasswordPoliciesPort;
import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ListPasswordPoliciesUseCaseImpl implements ListPasswordPoliciesUseCase {

    private final ListPasswordPoliciesPort listPasswordPoliciesPort;

    @Override
    public List<PasswordPolicy> listPolicies() {
        return listPasswordPoliciesPort.listPolicies();
    }
}
