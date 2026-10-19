package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.SaveUserSessionPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
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
import static org.mockito.Mockito.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Apertura de sesión opaca: solo usuarios existentes y activos pueden tener sesión. */
@ExtendWith(MockitoExtension.class)
@DisplayName("CreateUserSessionUseCaseImpl unit tests")
class CreateUserSessionUseCaseImplTest {

    @Mock LoadUserPort loadUserPort;
    @Mock SaveUserSessionPort saveUserSessionPort;

    private CreateUserSessionUseCaseImpl useCase;
    private UUID userId;
    private User activeUser;

    @BeforeEach
    void setUp() {
        useCase = new CreateUserSessionUseCaseImpl(loadUserPort, saveUserSessionPort);
        userId = UUID.randomUUID();
        activeUser = new User();
        activeUser.setUserId(userId);
        activeUser.setUsername("carolina.mendoza");
        activeUser.setStatus(true);
    }

    @Test
    @DisplayName("givenActiveUser_whenCreateSession_thenStartsActiveAndSaves")
    void givenActiveUser_whenCreateSession_thenStartsActiveAndSaves() {
        // Arrange
        when(loadUserPort.loadUser(userId)).thenReturn(activeUser);
        when(saveUserSessionPort.saveUserSession(any(UserSession.class)))
                .thenAnswer(call -> call.getArgument(0));

        // Act
        UserSession session = useCase.createSession(userId, "10.0.0.5");

        // Assert
        assertThat(session.getSessionStatus()).isEqualTo(UserSession.STATUS_ACTIVE);
        assertThat(session.getStartDate()).isNotNull();
        assertThat(session.getEndDate()).isNull();
        assertThat(session.getSourceIp()).isEqualTo("10.0.0.5");
        assertThat(session.getUserId()).isSameAs(activeUser);
        verify(saveUserSessionPort).saveUserSession(session);
    }

    @Test
    @DisplayName("givenUnknownUser_whenCreateSession_thenEntityNotFound")
    void givenUnknownUser_whenCreateSession_thenEntityNotFound() {
        // Arrange
        when(loadUserPort.loadUser(userId)).thenReturn(null);

        // Act & Assert
        assertThatThrownBy(() -> useCase.createSession(userId, "10.0.0.5"))
                .isInstanceOfSatisfying(EntityNotFoundException.class, ex -> {
                    assertThat(ex.getEntityName()).isEqualTo("User");
                    assertThat(ex.getIdentifier()).isEqualTo(userId);
                });
        verify(saveUserSessionPort, never()).saveUserSession(any());
    }

    @Test
    @DisplayName("givenInactiveUser_whenCreateSession_thenValidationException")
    void givenInactiveUser_whenCreateSession_thenValidationException() {
        // Arrange
        activeUser.setStatus(false);
        when(loadUserPort.loadUser(userId)).thenReturn(activeUser);

        // Act & Assert
        assertThatThrownBy(() -> useCase.createSession(userId, "10.0.0.5"))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Cannot create session for inactive user");
        verify(saveUserSessionPort, never()).saveUserSession(any());
    }

    @Test
    @DisplayName("givenNullUserId_whenCreateSession_thenEntityNotFound")
    void givenNullUserId_whenCreateSession_thenEntityNotFound() {
        // Arrange: el puerto responde null también para un id nulo
        when(loadUserPort.loadUser(isNull())).thenReturn(null);

        // Act & Assert
        assertThatThrownBy(() -> useCase.createSession(null, "10.0.0.5"))
                .isInstanceOfSatisfying(EntityNotFoundException.class, ex ->
                        assertThat(ex.getEntityName()).isEqualTo("User"));
        verify(saveUserSessionPort, never()).saveUserSession(any());
    }
}
