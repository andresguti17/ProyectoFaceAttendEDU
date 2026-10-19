package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Paso 2 de la recuperación: correo válido + código de exactamente 6 dígitos y reto vigente. */
@ExtendWith(MockitoExtension.class)
@DisplayName("VerifyRecoveryCodeUseCaseImpl unit tests")
class VerifyRecoveryCodeUseCaseImplTest {

    private static final String EMAIL = "carolina.mendoza@example.com";

    @Mock RecoveryCodePort recoveryCodePort;

    private VerifyRecoveryCodeUseCaseImpl useCase;

    @BeforeEach
    void setUp() {
        useCase = new VerifyRecoveryCodeUseCaseImpl(recoveryCodePort);
    }

    @ParameterizedTest(name = "[{index}] malformed email ''{0}''")
    @NullSource
    @ValueSource(strings = {"not-an-email", "missing-domain@", "   "})
    @DisplayName("givenMalformedEmail_whenVerify_thenValidationException")
    void givenMalformedEmail_whenVerify_thenValidationException(String email) {
        assertThatThrownBy(() -> useCase.verify(email, "123456"))
                .isInstanceOf(ValidationException.class)
                .hasMessage("A valid email is required");
        verifyNoInteractions(recoveryCodePort);
    }

    @ParameterizedTest(name = "[{index}] code ''{0}'' is not six digits")
    @NullSource
    @ValueSource(strings = {"", "12345", "1234567", "abcdef", "12 456", "12345a"})
    @DisplayName("givenCodeNotSixDigits_whenVerify_thenValidationException")
    void givenCodeNotSixDigits_whenVerify_thenValidationException(String code) {
        assertThatThrownBy(() -> useCase.verify(EMAIL, code))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Code must be 6 digits");
        verifyNoInteractions(recoveryCodePort);
    }

    @Test
    @DisplayName("givenWrongCode_whenVerify_thenUnauthorizedException")
    void givenWrongCode_whenVerify_thenUnauthorizedException() {
        // Arrange: incorrecto, vencido o agotado -> mismo 401 sin filtrar el motivo
        when(recoveryCodePort.verify(EMAIL, "000000")).thenReturn(false);

        // Act & Assert
        assertThatThrownBy(() -> useCase.verify(EMAIL, "000000"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Invalid or expired code");
    }

    @Test
    @DisplayName("givenValidCode_whenVerify_thenNoException")
    void givenValidCode_whenVerify_thenNoException() {
        // Arrange
        when(recoveryCodePort.verify(EMAIL, "123456")).thenReturn(true);

        // Act & Assert
        assertThatCode(() -> useCase.verify(EMAIL, "123456")).doesNotThrowAnyException();

        verify(recoveryCodePort).verify(EMAIL, "123456");
    }

    @Test
    @DisplayName("givenUppercaseEmailAndPaddedCode_whenVerify_thenNormalizedBeforeLookup")
    void givenUppercaseEmailAndPaddedCode_whenVerify_thenNormalizedBeforeLookup() {
        // Arrange: minúsculas + trim compartidos con requestCode (Emails.normalize)
        when(recoveryCodePort.verify(eq(EMAIL), eq("123456"))).thenReturn(true);

        // Act
        assertThatCode(() -> useCase.verify("  Carolina.Mendoza@Example.COM ", " 123456 ")).doesNotThrowAnyException();

        // Assert
        verify(recoveryCodePort).verify(EMAIL, "123456");
    }
}
