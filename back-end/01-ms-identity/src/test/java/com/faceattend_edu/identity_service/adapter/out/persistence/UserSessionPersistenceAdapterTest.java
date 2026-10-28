package com.faceattend_edu.identity_service.adapter.out.persistence;

import com.faceattend_edu.identity_service.adapter.out.persistence.crypto.SessionTokenHasher;
import com.faceattend_edu.identity_service.adapter.out.persistence.entity.UserSessionJpaEntity;
import com.faceattend_edu.identity_service.adapter.out.persistence.mapper.UserSessionPersistenceMapper;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.UserSessionJpaRepository;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** N-04: la tabla guarda el resumen del token, nunca el token que usa el cliente como bearer. */
@ExtendWith(MockitoExtension.class)
@DisplayName("UserSessionPersistenceAdapter stores only the token digest")
class UserSessionPersistenceAdapterTest {

    @Mock UserSessionJpaRepository repository;
    @Mock UserSessionPersistenceMapper mapper;

    private UserSessionPersistenceAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new UserSessionPersistenceAdapter(repository, mapper);
    }

    @Test
    @DisplayName("givenNewSession_whenSave_thenRowKeyedByDigestAndTokenReturned")
    void saveStoresDigestAndReturnsToken() {
        UserSession session = new UserSession();
        when(mapper.toEntity(any())).thenReturn(new UserSessionJpaEntity());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(mapper.toDomain(any())).thenAnswer(inv -> {
            UserSessionJpaEntity e = inv.getArgument(0);
            UserSession d = new UserSession();
            d.setSessionId(e.getSessionId());
            d.setStartDate(LocalDateTime.now());
            return d;
        });

        UserSession saved = adapter.saveUserSession(session);

        ArgumentCaptor<UserSessionJpaEntity> stored = ArgumentCaptor.forClass(UserSessionJpaEntity.class);
        verify(repository).save(stored.capture());
        UUID token = saved.getSessionId();
        assertThat(token).isNotNull();
        assertThat(stored.getValue().getSessionId()).isEqualTo(SessionTokenHasher.hash(token));
        assertThat(stored.getValue().getSessionId()).isNotEqualTo(token);
    }

    @Test
    @DisplayName("givenToken_whenLoad_thenLooksUpByDigest")
    void loadLooksUpByDigest() {
        UUID token = UUID.randomUUID();
        when(repository.findById(SessionTokenHasher.hash(token))).thenReturn(Optional.of(new UserSessionJpaEntity()));
        when(mapper.toDomain(any())).thenReturn(new UserSession());

        assertThat(adapter.loadUserSession(token)).isNotNull();
        verify(repository).findById(SessionTokenHasher.hash(token));
    }

    @Test
    @DisplayName("givenStoredDigest_whenLoadAsToken_thenNotFound")
    void storedDigestIsNotAValidBearer() {
        UUID token = UUID.randomUUID();
        UUID digest = SessionTokenHasher.hash(token);
        // Una fila filtrada de la tabla solo contiene el resumen: presentarlo como token no encuentra nada.
        when(repository.findById(SessionTokenHasher.hash(digest))).thenReturn(Optional.empty());
        when(mapper.toDomain(null)).thenReturn(null);

        assertThat(adapter.loadUserSession(digest)).isNull();
    }

    @Test
    @DisplayName("givenToken_whenCloseIfActive_thenUsesDigest")
    void closeIfActiveUsesDigest() {
        UUID token = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();
        when(repository.closeIfActive(SessionTokenHasher.hash(token), now, UserSession.STATUS_ACTIVE, UserSession.STATUS_CLOSED)).thenReturn(1);

        assertThat(adapter.closeSessionIfActive(token, now)).isEqualTo(1);
    }
}
