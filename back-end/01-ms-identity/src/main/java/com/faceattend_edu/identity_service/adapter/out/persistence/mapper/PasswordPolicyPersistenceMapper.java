package com.faceattend_edu.identity_service.adapter.out.persistence.mapper;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.PasswordPolicyJpaEntity;
import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class PasswordPolicyPersistenceMapper {

    public PasswordPolicy toDomain(PasswordPolicyJpaEntity entity) {
        if (entity == null) return null;
        return new PasswordPolicy(
            entity.getPolicyId(),
            entity.getMinLength(),
            entity.getMaxLength(),
            entity.getRequiresUppercase(),
            entity.getRequiresNumbers(),
            entity.getRequiresSymbols(),
            entity.getExpirationDays(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }

    public PasswordPolicyJpaEntity toEntity(PasswordPolicy domain) {
        if (domain == null) return null;
        PasswordPolicyJpaEntity entity = new PasswordPolicyJpaEntity();
        entity.setPolicyId(domain.getPolicyId());
        entity.setMinLength(domain.getMinLength());
        entity.setMaxLength(domain.getMaxLength());
        entity.setRequiresUppercase(domain.getRequiresUppercase());
        entity.setRequiresNumbers(domain.getRequiresNumbers());
        entity.setRequiresSymbols(domain.getRequiresSymbols());
        entity.setExpirationDays(domain.getExpirationDays());
        entity.setCreatedAt(domain.getCreatedAt());
        entity.setUpdatedAt(domain.getUpdatedAt());
        // created_at es NOT NULL sin default en el DDL canonico.
        if (entity.getCreatedAt() == null) entity.setCreatedAt(LocalDateTime.now());
        return entity;
    }
}
