package com.faceattend_edu.identity_service.adapter.in.web.mapper;

import com.faceattend_edu.identity_service.adapter.in.web.dto.UserSessionDto;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** El login expone si la cuenta sigue con la contraseña inicial. */
@DisplayName("UserSessionWebMapper unit tests")
class UserSessionWebMapperTest {

    private final UserSessionWebMapper mapper = new UserSessionWebMapper();

    private UserSession sessionOf(boolean mustChangePassword) {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setMustChangePassword(mustChangePassword);
        UserSession session = new UserSession();
        session.setSessionId(UUID.randomUUID());
        session.setUserId(user);
        return session;
    }

    @Test
    @DisplayName("exposes mustChangePassword from the account")
    void exposesFlag() {
        UserSessionDto dto = mapper.toDto(sessionOf(true));
        assertThat(dto.isMustChangePassword()).isTrue();
        assertThat(mapper.toDto(sessionOf(false)).isMustChangePassword()).isFalse();
    }

    @Test
    @DisplayName("defaults to false when the session has no user")
    void noUser() {
        UserSession session = new UserSession();
        session.setSessionId(UUID.randomUUID());
        assertThat(mapper.toDto(session).isMustChangePassword()).isFalse();
    }
}
