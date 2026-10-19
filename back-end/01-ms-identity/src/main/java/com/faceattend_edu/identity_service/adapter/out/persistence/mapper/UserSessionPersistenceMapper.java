package com.faceattend_edu.identity_service.adapter.out.persistence.mapper;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.UserSessionJpaEntity;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class UserSessionPersistenceMapper {

    private final UserPersistenceMapper userPersistenceMapper;

    public UserSession toDomain(UserSessionJpaEntity entity) {
        if (entity == null) return null;
        return new UserSession(
            entity.getSessionId(),
            userPersistenceMapper.toDomain(entity.getUser()),
            entity.getStartDate(),
            entity.getEndDate(),
            entity.getSourceIp(),
            entity.getSessionStatus()
        );
    }

    public UserSessionJpaEntity toEntity(UserSession domain) {
        if (domain == null) return null;
        UserSessionJpaEntity entity = new UserSessionJpaEntity();
        entity.setSessionId(domain.getSessionId());
        entity.setUser(userPersistenceMapper.toEntity(domain.getUserId()));
        entity.setStartDate(domain.getStartDate());
        entity.setEndDate(domain.getEndDate());
        entity.setSourceIp(domain.getSourceIp());
        entity.setSessionStatus(domain.getSessionStatus());
        // start_date y created_at son NOT NULL sin default en el DDL canonico.
        if (entity.getStartDate() == null) entity.setStartDate(LocalDateTime.now());
        if (entity.getCreatedAt() == null) entity.setCreatedAt(LocalDateTime.now());
        return entity;
    }
}
