package com.faceattend_edu.identity_service.adapter.out.persistence.mapper;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.UserJpaEntity;
import com.faceattend_edu.identity_service.domain.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class UserPersistenceMapper {

    private final PersonPersistenceMapper personPersistenceMapper;

    public User toDomain(UserJpaEntity entity) {
        if (entity == null) return null;
        return new User(
            entity.getUserId(),
            personPersistenceMapper.toDomain(entity.getPerson()),
            entity.getUsername(),
            entity.getPasswordHash(),
            entity.getAuthenticationType(),
            entity.getStatus(),
            entity.getCreatedAt(),
            entity.getUpdatedAt(),
            entity.getLastAccess()
        );
    }

    public UserJpaEntity toEntity(User domain) {
        if (domain == null) return null;
        UserJpaEntity entity = new UserJpaEntity();
        entity.setUserId(domain.getUserId());
        entity.setPerson(personPersistenceMapper.toEntity(domain.getPersonId()));
        entity.setUsername(domain.getUsername());
        entity.setPasswordHash(domain.getPasswordHash());
        entity.setAuthenticationType(domain.getAuthenticationType());
        entity.setStatus(domain.getStatus());
        entity.setCreatedAt(domain.getCreatedAt());
        entity.setUpdatedAt(domain.getUpdatedAt());
        entity.setLastAccess(domain.getLastAccess());
        return entity;
    }
}
