package com.faceattend_edu.identity_service.adapter.in.web.mapper;

import com.faceattend_edu.identity_service.adapter.in.web.dto.PasswordPolicyDto;
import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;
import org.springframework.stereotype.Component;

@Component
public class PasswordPolicyWebMapper {

    public PasswordPolicyDto toDto(PasswordPolicy domain) {
        if (domain == null) return null;
        PasswordPolicyDto dto = new PasswordPolicyDto();
        dto.setPolicyId(domain.getPolicyId());
        dto.setMinLength(domain.getMinLength());
        dto.setMaxLength(domain.getMaxLength());
        dto.setRequiresUppercase(domain.getRequiresUppercase());
        dto.setRequiresNumbers(domain.getRequiresNumbers());
        dto.setRequiresSymbols(domain.getRequiresSymbols());
        dto.setExpirationDays(domain.getExpirationDays());
        return dto;
    }

    public PasswordPolicy toDomain(PasswordPolicyDto dto) {
        if (dto == null) return null;
        PasswordPolicy policy = new PasswordPolicy();
        policy.setPolicyId(dto.getPolicyId());
        policy.setMinLength(dto.getMinLength());
        policy.setMaxLength(dto.getMaxLength());
        policy.setRequiresUppercase(dto.getRequiresUppercase());
        policy.setRequiresNumbers(dto.getRequiresNumbers());
        policy.setRequiresSymbols(dto.getRequiresSymbols());
        policy.setExpirationDays(dto.getExpirationDays());
        return policy;
    }
}
