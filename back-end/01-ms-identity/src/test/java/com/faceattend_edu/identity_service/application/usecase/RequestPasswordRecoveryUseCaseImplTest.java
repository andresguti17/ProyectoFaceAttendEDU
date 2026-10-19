package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.out.LoadUserByIdentifierPort;
import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort;
import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort.IssuedCode;
import com.faceattend_edu.identity_service.application.port.out.SendRecoveryEmailPort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Paso 1 de la recuperación: formato de correo obligatorio, anti-enumeración
 * (cuenta desconocida o inactiva = retorno silencioso) y cooldown de reenvío.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("RequestPasswordRecoveryUseCaseImpl unit tests")
class RequestPasswordRecoveryUseCaseImplTest {

    private static final String EMAIL = "carolina.mendoza@example.com";

    @Mock LoadUserByIdentifierPort loadUserByIdentifierPort;
    @Mock RecoveryCodePort recoveryCodePort;
    @Mock SendRecoveryEmailPort sendRecoveryEmailPort;

    private RequestPasswordRecoveryUseCaseImpl useCase;

    @BeforeEach
    void setUp() {
        // AuthProperties real: valores por defecto (code-ttl = 10 minutos)
        useCase = new RequestPasswordRecoveryUseCaseImpl(
                loadUserByIdentifierPort, recoveryCodePort, sendRecoveryEmailPort, new AuthProperties());
    }

    private User activeUser() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername("carolina.mendoza");
        user.setStatus(true);
        return user;
    }

    @ParameterizedTest(name = "[{index}] malformed email ''{0}''")
    @ValueSource(strings = {"not-an-email", "missing-domain@", "two@@example.com", "   "})
    @DisplayName("givenMalformedEmail_whenRequestCode_thenValidationExceptionAndNoPortCalls")
    void givenMalformedEmail_whenRequestCode_thenValidationExceptionAndNoPortCalls(String email) {
        assertThatThrownBy(() -> useCase.requestCode(email))
                .isInstanceOf(ValidationException.class)
                .hasMessage("A valid email is required");
        verifyNoInteractions(loadUserByIdentifierPort, recoveryCodePort, sendRecoveryEmailPort);
    }

    @Test
    @DisplayName("givenUnknownAccount_whenRequestCode_thenSilentReturnWithoutIssuing")
    void givenUnknownAccount_whenRequestCode_thenSilentReturnWithoutIssuing() {
        // Arrange: la cuenta no existe; la respuesta no puede revelarlo
        when(loadUserByIdentifierPort.loadUserByIdentifier(EMAIL)).thenReturn(null);

        // Act & Assert: no lanza
        assertThatCode(() -> useCase.requestCode(EMAIL)).doesNotThrowAnyException();

        verify(recoveryCodePort, never()).issue(any(), any());
        verifyNoInteractions(sendRecoveryEmailPort);
    }

    @Test
    @DisplayName("givenInactiveAccount_whenRequestCode_thenSilentReturnWithoutIssuing")
    void givenInactiveAccount_whenRequestCode_thenSilentReturnWithoutIssuing() {
        // Arrange
        User inactive = activeUser();
        inactive.setStatus(false);
        when(loadUserByIdentifierPort.loadUserByIdentifier(EMAIL)).thenReturn(inactive);

        // Act & Assert
        assertThatCode(() -> useCase.requestCode(EMAIL)).doesNotThrowAnyException();

        verify(recoveryCodePort, never()).issue(any(), any());
        verifyNoInteractions(sendRecoveryEmailPort);
    }

    @Test
    @DisplayName("givenActiveAccount_whenRequestCode_thenIssuesCodeAndSendsEmail")
    void givenActiveAccount_whenRequestCode_thenIssuesCodeAndSendsEmail() {
        // Arrange
        Duration ttl = Duration.ofMinutes(10);
        IssuedCode issued = new IssuedCode(EMAIL, "123456", LocalDateTime.now().plus(ttl));
        when(loadUserByIdentifierPort.loadUserByIdentifier(EMAIL)).thenReturn(activeUser());
        when(recoveryCodePort.issue(EMAIL, ttl)).thenReturn(issued);
        when(sendRecoveryEmailPort.sendRecoveryCode(EMAIL, "123456", ttl)).thenReturn(true);

        // Act
        assertThatCode(() -> useCase.requestCode(EMAIL)).doesNotThrowAnyException();

        // Assert
        verify(sendRecoveryEmailPort).sendRecoveryCode(EMAIL, "123456", ttl);
    }

    @Test
    @DisplayName("givenCooldownActive_whenRequestCode_thenNoEmailIsSent")
    void givenCooldownActive_whenRequestCode_thenNoEmailIsSent() {
        // Arrange: issue devuelve null = aún no pasó la ventana de reenvío
        Duration ttl = Duration.ofMinutes(10);
        when(loadUserByIdentifierPort.loadUserByIdentifier(EMAIL)).thenReturn(activeUser());
        when(recoveryCodePort.issue(EMAIL, ttl)).thenReturn(null);

        // Act & Assert: no lanza y no reenvía
        assertThatCode(() -> useCase.requestCode(EMAIL)).doesNotThrowAnyException();

        verifyNoInteractions(sendRecoveryEmailPort);
    }

    @Test
    @DisplayName("givenUppercaseEmail_whenRequestCode_thenNormalizesBeforeLookup")
    void givenUppercaseEmail_whenRequestCode_thenNormalizesBeforeLookup() {
        // Arrange: minúsculas + trim compartidos con login (Emails.normalize)
        Duration ttl = Duration.ofMinutes(10);
        IssuedCode issued = new IssuedCode(EMAIL, "123456", LocalDateTime.now().plus(ttl));
        when(loadUserByIdentifierPort.loadUserByIdentifier(EMAIL)).thenReturn(activeUser());
        when(recoveryCodePort.issue(eq(EMAIL), eq(ttl))).thenReturn(issued);

        // Act
        assertThatCode(() -> useCase.requestCode("  Carolina.Mendoza@Example.COM ")).doesNotThrowAnyException();

        // Assert: el almacén recibe la forma normalizada, no la original
        verify(recoveryCodePort).issue(EMAIL, ttl);
    }

    @Test
    @DisplayName("givenEmailChannelDown_whenRequestCode_thenStaysSilent")
    void givenEmailChannelDown_whenRequestCode_thenStaysSilent() {
        // Arrange: notification no acepta el mensaje; el código sigue vivo en memoria
        Duration ttl = Duration.ofMinutes(10);
        IssuedCode issued = new IssuedCode(EMAIL, "123456", LocalDateTime.now().plus(ttl));
        when(loadUserByIdentifierPort.loadUserByIdentifier(EMAIL)).thenReturn(activeUser());
        when(recoveryCodePort.issue(EMAIL, ttl)).thenReturn(issued);
        when(sendRecoveryEmailPort.sendRecoveryCode(EMAIL, "123456", ttl)).thenReturn(false);

        // Act & Assert: no lanza aunque el correo falle
        assertThatCode(() -> useCase.requestCode(EMAIL)).doesNotThrowAnyException();
    }
}
