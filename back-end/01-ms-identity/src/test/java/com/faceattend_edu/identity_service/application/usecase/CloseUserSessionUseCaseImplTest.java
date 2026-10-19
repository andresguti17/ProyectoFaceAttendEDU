package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.out.LoadUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserSessionPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Logout: cerrar una sesión existente; una sesión desconocida no toca el puerto de update. */
@ExtendWith(MockitoExtension.class)
@DisplayName("CloseUserSessionUseCaseImpl unit tests")
class CloseUserSessionUseCaseImplTest {

    @Mock LoadUserSessionPort loadUserSessionPort;
    @Mock UpdateUserSessionPort updateUserSessionPort;

    private CloseUserSessionUseCaseImpl useCase;
    private UUID sessionId;
    private UserSession activeSession;

    @BeforeEach
    void setUp() {
        useCase = new CloseUserSessionUseCaseImpl(loadUserSessionPort, updateUserSessionPort);
        sessionId = UUID.randomUUID();

        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername("carolina.mendoza");

        activeSession = new UserSession();
        activeSession.setSessionId(sessionId);
        activeSession.setUserId(user);
        activeSession.setSourceIp("10.0.0.5");
        activeSession.start();
    }

    @Test
    @DisplayName("givenActiveSession_whenCloseSession_thenClosesAndUpdates")
    void givenActiveSession_whenCloseSession_thenClosesAndUpdates() {
        // Arrange
        when(loadUserSessionPort.loadUserSession(sessionId)).thenReturn(activeSession);

        // Act
        useCase.closeSession(sessionId);

        // Assert
        assertThat(activeSession.getSessionStatus()).isEqualTo(UserSession.STATUS_CLOSED);
        assertThat(activeSession.getEndDate()).isNotNull();
        assertThat(activeSession.isActive()).isFalse();
        verify(updateUserSessionPort).updateUserSession(activeSession);
    }

    @Test
    @DisplayName("givenUnknownSession_whenCloseSession_thenEntityNotFoundAndNeverUpdates")
    void givenUnknownSession_whenCloseSession_thenEntityNotFoundAndNeverUpdates() {
        // Arrange
        when(loadUserSessionPort.loadUserSession(sessionId)).thenReturn(null);

        // Act & Assert
        assertThatThrownBy(() -> useCase.closeSession(sessionId))
                .isInstanceOfSatisfying(EntityNotFoundException.class, ex -> {
                    assertThat(ex.getEntityName()).isEqualTo("UserSession");
                    assertThat(ex.getIdentifier()).isEqualTo(sessionId);
                    assertThat(ex.getMessage()).isEqualTo("UserSession not found with identifier=" + sessionId);
                });
        verify(updateUserSessionPort, never()).updateUserSession(any());
    }
}
