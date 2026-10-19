package com.faceattend_edu.identity_service.adapter.out.persistence;

import com.faceattend_edu.identity_service.adapter.out.persistence.mapper.PasswordPolicyPersistenceMapper;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.PasswordPolicyJpaRepository;
import com.faceattend_edu.identity_service.application.port.out.ListPasswordPoliciesPort;
import com.faceattend_edu.identity_service.application.port.out.LoadPasswordPolicyPort;
import com.faceattend_edu.identity_service.application.port.out.SavePasswordPolicyPort;
import com.faceattend_edu.identity_service.application.port.out.UpdatePasswordPolicyPort;
import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class PasswordPolicyPersistenceAdapter implements LoadPasswordPolicyPort, SavePasswordPolicyPort, UpdatePasswordPolicyPort, ListPasswordPoliciesPort {

    private final PasswordPolicyJpaRepository repository;
    private final PasswordPolicyPersistenceMapper mapper;

    @Override
    public PasswordPolicy loadPolicy(Integer policyId) {
        return mapper.toDomain(repository.findById(policyId).orElse(null));
    }

    @Override
    public List<PasswordPolicy> listPolicies() {
        return repository.findAll().stream().map(mapper::toDomain).collect(Collectors.toList());
    }

    @Override
    public PasswordPolicy savePolicy(PasswordPolicy policy) {
        return mapper.toDomain(repository.save(mapper.toEntity(policy)));
    }

    @Override
    public void updatePolicy(PasswordPolicy policy) {
        repository.save(mapper.toEntity(policy));
    }
}
