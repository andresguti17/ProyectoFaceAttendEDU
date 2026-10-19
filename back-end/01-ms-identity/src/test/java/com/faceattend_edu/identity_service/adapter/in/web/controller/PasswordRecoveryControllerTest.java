package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.application.port.in.ChangePasswordUseCase;
import com.faceattend_edu.identity_service.application.port.in.RequestPasswordRecoveryUseCase;
import com.faceattend_edu.identity_service.application.port.in.ResetPasswordUseCase;
import com.faceattend_edu.identity_service.application.port.in.VerifyRecoveryCodeUseCase;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Cobertura HTTP (MockMvc) de {@code PasswordRecoveryController}: los tres pasos
 * de la recuperación de contraseña. Ninguna respuesta distingue si la cuenta
 * existe (anti-enumeración): forgot-password siempre responde 202.
 */
@WebMvcTest(controllers = PasswordRecoveryController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("PasswordRecoveryController HTTP tests (MockMvc)")
class PasswordRecoveryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RequestPasswordRecoveryUseCase requestPasswordRecoveryUseCase;
    @MockitoBean
    private VerifyRecoveryCodeUseCase verifyRecoveryCodeUseCase;
    @MockitoBean
    private ResetPasswordUseCase resetPasswordUseCase;

    @MockitoBean
    private ChangePasswordUseCase changePasswordUseCase;

    private static final String EMAIL = "carolina.mendoza@example.com";

    @Nested
    @DisplayName("POST /api/v1/auth/forgot-password")
    class ForgotPasswordTests {

        @Test
        @DisplayName("givenUnknownAccount_whenForgotPassword_thenReturn202Accepted")
        void givenUnknownAccount_whenForgotPassword_thenReturn202Accepted() throws Exception {
            // Arrange: el caso de uso no lanza (rama de cuenta inexistente) y aun así
            // el cliente debe recibir 202 para no revelar si el correo existe.

            // Act & Assert
            mockMvc.perform(post("/api/v1/auth/forgot-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"ghost@example.com\"}"))
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.status").value("accepted"));

            verify(requestPasswordRecoveryUseCase).requestCode("ghost@example.com");
        }

        @Test
        @DisplayName("givenKnownAccount_whenForgotPassword_thenReturn202Accepted")
        void givenKnownAccount_whenForgotPassword_thenReturn202Accepted() throws Exception {
            // Act & Assert: respuesta idéntica a la de cuenta inexistente
            mockMvc.perform(post("/api/v1/auth/forgot-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + EMAIL + "\"}"))
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.status").value("accepted"));
        }

        @Test
        @DisplayName("givenBlankEmail_whenForgotPassword_thenReturn400ValidationError")
        void givenBlankEmail_whenForgotPassword_thenReturn400ValidationError() throws Exception {
            // Arrange: ForgotPasswordRequest.email es @NotBlank

            // Act & Assert
            mockMvc.perform(post("/api/v1/auth/forgot-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"  \"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("email")));
        }
    }

    @Nested
    @DisplayName("POST /api/v1/auth/verify-code")
    class VerifyCodeTests {

        @Test
        @DisplayName("givenValidCode_whenVerifyCode_thenReturn200Verified")
        void givenValidCode_whenVerifyCode_thenReturn200Verified() throws Exception {
            // Act & Assert
            mockMvc.perform(post("/api/v1/auth/verify-code")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + EMAIL + "\",\"code\":\"123456\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("verified"));

            verify(verifyRecoveryCodeUseCase).verify(EMAIL, "123456");
        }

        @Test
        @DisplayName("givenMalformedCode_whenVerifyCode_thenReturn400ValidationError")
        void givenMalformedCode_whenVerifyCode_thenReturn400ValidationError() throws Exception {
            // Arrange: el caso de uso valida el formato 6 dígitos
            doThrow(new ValidationException("Code must be 6 digits"))
                    .when(verifyRecoveryCodeUseCase).verify(EMAIL, "123");

            // Act & Assert
            mockMvc.perform(post("/api/v1/auth/verify-code")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + EMAIL + "\",\"code\":\"123\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.message").value("Code must be 6 digits"));
        }

        @Test
        @DisplayName("givenWrongCode_whenVerifyCode_thenReturn401Unauthorized")
        void givenWrongCode_whenVerifyCode_thenReturn401Unauthorized() throws Exception {
            // Arrange
            doThrow(new UnauthorizedException("Invalid or expired code"))
                    .when(verifyRecoveryCodeUseCase).verify(EMAIL, "000000");

            // Act & Assert
            mockMvc.perform(post("/api/v1/auth/verify-code")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + EMAIL + "\",\"code\":\"000000\"}"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
                    .andExpect(jsonPath("$.message").value("Invalid or expired code"));
        }
    }

    @Nested
    @DisplayName("POST /api/v1/auth/reset-password")
    class ResetPasswordTests {

        @Test
        @DisplayName("givenVerifiedChallenge_whenResetPassword_thenReturn200Updated")
        void givenVerifiedChallenge_whenResetPassword_thenReturn200Updated() throws Exception {
            // Act & Assert: el reto ya quedó verificado en /verify-code
            mockMvc.perform(post("/api/v1/auth/reset-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + EMAIL + "\",\"password\":\"NuevaClave1!\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("updated"));

            verify(resetPasswordUseCase).resetPassword(EMAIL, "NuevaClave1!");
        }
    }
}
