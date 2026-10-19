package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.out.LoadUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.SaveUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserSessionPort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * IEEE 829 - rotación de la sesión opaca (refresh token).
 */
class RefreshSessionUseCaseImplTest {

    private FakeLoadSession loadSession;
    private FakeUpdateSession updateSession;
    private FakeSaveSession saveSession;
    private RefreshSessionUseCaseImpl useCase;

    @BeforeEach
    void setUp() {
        loadSession = new FakeLoadSession();
        updateSession = new FakeUpdateSession();
        saveSession = new FakeSaveSession();
        useCase = new RefreshSessionUseCaseImpl(loadSession, updateSession, saveSession, new AuthProperties());
    }

    @Test
    void rotatesActiveSessionIntoANewOne() {
        UserSession current = activeSession();
        loadSession.session = current;

        UserSession refreshed = useCase.refresh(current.getSessionId(), "10.0.0.5");

        assertThat(refreshed.getSessionId()).isNotEqualTo(current.getSessionId());
        assertThat(refreshed.getSessionStatus()).isEqualTo(UserSession.STATUS_ACTIVE);
        assertThat(refreshed.getSourceIp()).isEqualTo("10.0.0.5");
        assertThat(refreshed.getUserId().getUserId()).isEqualTo(current.getUserId().getUserId());
        // La sesión vieja se cerró vía UPDATE condicional, no con save().
        assertThat(updateSession.closedSessionId).isEqualTo(current.getSessionId());
        assertThat(updateSession.updateCalls).isZero();
    }

    @Test
    void rejectsClosedSession() {
        UserSession closed = activeSession();
        closed.end();
        loadSession.session = closed;

        assertThatThrownBy(() -> useCase.refresh(closed.getSessionId(), null))
                .isInstanceOf(UnauthorizedException.class);
        assertThat(saveSession.saved).isNull();
    }

    @Test
    void rejectsExpiredSessionAndClosesIt() {
        UserSession expired = activeSession();
        expired.setStartDate(LocalDateTime.now().minusHours(9)); // timeout por defecto: 480 min
        loadSession.session = expired;

        assertThatThrownBy(() -> useCase.refresh(expired.getSessionId(), null))
                .isInstanceOf(UnauthorizedException.class);

        assertThat(expired.getSessionStatus()).isEqualTo(UserSession.STATUS_CLOSED);
        assertThat(updateSession.updateCalls).isEqualTo(1);
        assertThat(saveSession.saved).isNull();
    }

    @Test
    void rejectsWhenAnotherCallerAlreadyRotatedTheSession() {
        loadSession.session = activeSession();
        updateSession.closeResult = 0;

        assertThatThrownBy(() -> useCase.refresh(loadSession.session.getSessionId(), null))
                .isInstanceOf(UnauthorizedException.class);
        assertThat(saveSession.saved).isNull();
    }

    @Test
    void rejectsUnknownSession() {
        loadSession.session = null;

        assertThatThrownBy(() -> useCase.refresh(UUID.randomUUID(), null))
                .isInstanceOf(UnauthorizedException.class);
    }

    private UserSession activeSession() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername("carolina.mendoza");
        user.setStatus(true);

        UserSession session = new UserSession();
        session.setSessionId(UUID.randomUUID());
        session.setUserId(user);
        session.start();
        return session;
    }

    private static final class FakeLoadSession implements LoadUserSessionPort {
        private UserSession session;

        @Override
        public UserSession loadUserSession(UUID sessionId) {
            return session != null && session.getSessionId().equals(sessionId) ? session : null;
        }
    }

    private static final class FakeUpdateSession implements UpdateUserSessionPort {
        private int closeResult = 1;
        private int updateCalls;
        private UUID closedSessionId;

        @Override
        public void updateUserSession(UserSession session) {
            updateCalls++;
        }

        @Override
        public int closeSessionIfActive(UUID sessionId, LocalDateTime closedAt) {
            closedSessionId = sessionId;
            return closeResult;
        }
    }

    private static final class FakeSaveSession implements SaveUserSessionPort {
        private UserSession saved;

        @Override
        public UserSession saveUserSession(UserSession session) {
            session.setSessionId(UUID.randomUUID());
            saved = session;
            return session;
        }
    }
}
