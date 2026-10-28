package com.faceattend_edu.identity_service.adapter.out.persistence;

import com.faceattend_edu.identity_service.adapter.out.persistence.crypto.SessionTokenHasher;
import com.faceattend_edu.identity_service.adapter.out.persistence.entity.PersonJpaEntity;
import com.faceattend_edu.identity_service.adapter.out.persistence.entity.UserJpaEntity;
import com.faceattend_edu.identity_service.adapter.out.persistence.mapper.PersonPersistenceMapper;
import com.faceattend_edu.identity_service.adapter.out.persistence.mapper.UserPersistenceMapper;
import com.faceattend_edu.identity_service.adapter.out.persistence.mapper.UserSessionPersistenceMapper;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.PersonJpaRepository;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.UserJpaRepository;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.UserSessionJpaRepository;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** N-04 contra una base real (H2): el token solo sirve a quien lo recibió; la fila guarda su resumen. */
@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true",
        "spring.datasource.url=jdbc:h2:mem:sessions;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1;INIT=RUNSCRIPT FROM 'classpath:session-roundtrip-schema.sql'",
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("User sessions are stored under the token digest")
class UserSessionRoundTripTest {

    @Autowired PersonJpaRepository people;
    @Autowired UserJpaRepository users;
    @Autowired UserSessionJpaRepository sessions;
    @Autowired EntityManager em;

    private UserSessionPersistenceAdapter adapter;
    private UserSession toSave;

    @BeforeEach
    void setUp() {
        // row_version no se inserta desde JPA: en PostgreSQL lo rellena el DEFAULT 1 del DDL.
        for (String table : new String[]{"person", "app_user", "user_session"}) {
            em.createNativeQuery("alter table \"identity\".\"" + table + "\" alter column \"row_version\" set default 1").executeUpdate();
        }

        PersonPersistenceMapper personMapper = new PersonPersistenceMapper();
        UserPersistenceMapper userMapper = new UserPersistenceMapper(personMapper);
        adapter = new UserSessionPersistenceAdapter(sessions, new UserSessionPersistenceMapper(userMapper));

        PersonJpaEntity p = new PersonJpaEntity();
        p.setDocumentType("CC");
        p.setDocumentNumber("1015407712");
        p.setName("Ana");
        p.setLastName("Rios");
        p.setEmail("ana@sede.edu.co");
        p.setStatus(true);
        p.setCreatedAt(LocalDateTime.now());
        p = people.saveAndFlush(p);

        UserJpaEntity u = new UserJpaEntity();
        u.setPerson(p);
        u.setUsername("ana.rios");
        u.setPasswordHash("x");
        u.setAuthenticationType("Local");
        u.setStatus(true);
        u.setCreatedAt(LocalDateTime.now());
        u = users.saveAndFlush(u);

        toSave = new UserSession();
        toSave.setUserId(userMapper.toDomain(u));
        toSave.setSourceIp("10.0.0.5");
        toSave.start();
    }

    private long rowsWithId(UUID id) {
        return ((Number) em.createNativeQuery("select count(*) from \"identity\".\"user_session\" where \"session_id\" = ?1")
                .setParameter(1, id).getSingleResult()).longValue();
    }

    @Test
    @DisplayName("givenSavedSession_whenInspectingTheTable_thenTokenIsNotThere")
    void tableHoldsTheDigestNotTheToken() {
        UUID token = adapter.saveUserSession(toSave).getSessionId();
        em.flush();
        em.clear();

        assertThat(rowsWithId(token)).isZero();
        assertThat(rowsWithId(SessionTokenHasher.hash(token))).isEqualTo(1);
    }

    @Test
    @DisplayName("givenSavedSession_whenLoadByTokenOrByStoredId_thenOnlyTheTokenAuthenticates")
    void onlyTheTokenLoadsTheSession() {
        UUID token = adapter.saveUserSession(toSave).getSessionId();
        em.flush();
        em.clear();
        UUID stored = SessionTokenHasher.hash(token);

        assertThat(adapter.loadUserSession(token)).isNotNull();
        assertThat(adapter.loadUserSession(stored)).isNull();
        assertThat(adapter.loadUserSessionByStoredId(stored)).isNotNull();
    }

    @Test
    @DisplayName("givenLoadedSession_whenClosedAndUpdated_thenSameRowIsUpdated")
    void updateKeepsTheSameRow() {
        UUID token = adapter.saveUserSession(toSave).getSessionId();
        em.flush();
        em.clear();

        UserSession loaded = adapter.loadUserSession(token);
        loaded.end();
        adapter.updateUserSession(loaded);
        em.flush();
        em.clear();

        assertThat(adapter.loadUserSession(token).isActive()).isFalse();
        assertThat(sessions.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("givenActiveSession_whenCloseIfActiveTwice_thenOnlyTheFirstWins")
    void closeIfActiveIsSingleUse() {
        UUID token = adapter.saveUserSession(toSave).getSessionId();
        em.flush();

        assertThat(adapter.closeSessionIfActive(token, LocalDateTime.now())).isEqualTo(1);
        assertThat(adapter.closeSessionIfActive(token, LocalDateTime.now())).isZero();
    }
}
