package com.faceattend_edu.identity_service.adapter.out.persistence;

import com.faceattend_edu.identity_service.adapter.out.persistence.mapper.UserSessionPersistenceMapper;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.UserSessionJpaRepository;
import com.faceattend_edu.identity_service.application.port.out.LoadUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserSessionsPort;
import com.faceattend_edu.identity_service.application.port.out.ListUserSessionsPort;
import com.faceattend_edu.identity_service.application.port.out.SaveUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserSessionPort;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class UserSessionPersistenceAdapter implements LoadUserSessionPort, LoadUserSessionsPort, SaveUserSessionPort, UpdateUserSessionPort, ListUserSessionsPort {

    private final UserSessionJpaRepository repository;
    private final UserSessionPersistenceMapper mapper;

    @Override
    public UserSession loadUserSession(UUID sessionId) {
        return mapper.toDomain(repository.findById(sessionId).orElse(null));
    }

    @Override
    public List<UserSession> listUserSessions() {
        return repository.findAll().stream().map(mapper::toDomain).collect(Collectors.toList());
    }

    @Override
    public List<UserSession> loadUserSessions(UUID userId) {
        return repository.findByUser_UserId(userId).stream()
                .map(mapper::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public UserSession saveUserSession(UserSession session) {
        return mapper.toDomain(repository.save(mapper.toEntity(session)));
    }

    @Override
    public void updateUserSession(UserSession session) {
        repository.save(mapper.toEntity(session));
    }

    @Override
    public int closeSessionIfActive(UUID sessionId, LocalDateTime closedAt) {
        return repository.closeIfActive(sessionId, closedAt,
                UserSession.STATUS_ACTIVE, UserSession.STATUS_CLOSED);
    }
}
