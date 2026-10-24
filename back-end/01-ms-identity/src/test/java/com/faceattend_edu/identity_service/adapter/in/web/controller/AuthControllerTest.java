package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.mapper.UserSessionWebMapper;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.UserWebMapper;
import com.faceattend_edu.identity_service.application.port.in.AuthenticateUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.CloseUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.GetUserByUsernameUseCase;
import com.faceattend_edu.identity_service.application.port.in.ManageTwoFactorUseCase;
import com.faceattend_edu.identity_service.application.port.in.VerifyLoginCodeUseCase;
import com.faceattend_edu.identity_service.application.port.in.RefreshSessionUseCase;
import com.faceattend_edu.identity_service.domain.exception.AccountLockedException;
import com.faceattend_edu.identity_service.domain.exception.TwoFactorRequiredException;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Cobertura HTTP (MockMvc) de {@code AuthController}: login, rotación de sesión
 * (refresh), logout y /me. El {@code AuthTokenFilter} queda fuera de la cadena
 * ({@code addFilters = false}) para no disparar llamadas HTTP a identity/authorization.
 */
@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({UserSessionWebMapper.class, UserWebMapper.class})
@DisplayName("AuthController HTTP tests (MockMvc)")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthenticateUserUseCase authenticateUserUseCase;
    @MockitoBean
    private CloseUserSessionUseCase closeUserSessionUseCase;
    @MockitoBean
    private GetUserByUsernameUseCase getUserByUsernameUseCase;
    @MockitoBean
    private RefreshSessionUseCase refreshSessionUseCase;
    @MockitoBean
    private VerifyLoginCodeUseCase verifyLoginCodeUseCase;
    @MockitoBean
    private ManageTwoFactorUseCase manageTwoFactorUseCase;

    private UserSession session;
    private UUID sessionId;
    private UUID userId;

    @BeforeEach
    void setUp() {
        User user = new User();
        userId = UUID.randomUUID();
        user.setUserId(userId);
        user.setUsername("carolina.mendoza");
        user.setStatus(true);

        sessionId = UUID.randomUUID();
        session = new UserSession();
        session.setSessionId(sessionId);
        session.setUserId(user);
        session.setSourceIp("10.0.0.5");
        session.start();
    }

    @Nested
    @DisplayName("two-factor")
    class TwoFactorTests {

        @Test
        @DisplayName("givenAccountWithTwoFactor_whenLogin_thenReturn200WithChallengeAndNoSession")
        void givenAccountWithTwoFactor_whenLogin_thenReturn200WithChallengeAndNoSession() throws Exception {
            when(authenticateUserUseCase.authenticate(eq("carolina.mendoza"), eq("Secret123"), any()))
                    .thenThrow(new TwoFactorRequiredException("c***@example.com"));

            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"identifier":"carolina.mendoza","password":"Secret123"}"""))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.twoFactorRequired").value(true))
                    .andExpect(jsonPath("$.maskedEmail").value("c***@example.com"))
                    .andExpect(jsonPath("$.sessionId").doesNotExist());
        }

        @Test
        @DisplayName("givenRightCode_whenVerifyLogin_thenReturn200Session")
        void givenRightCode_whenVerifyLogin_thenReturn200Session() throws Exception {
            when(verifyLoginCodeUseCase.verify("carolina.mendoza", "123456")).thenReturn(session);

            mockMvc.perform(post("/api/v1/auth/login/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"identifier":"carolina.mendoza","code":"123456"}"""))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.sessionId").value(sessionId.toString()))
                    .andExpect(jsonPath("$.twoFactorRequired").value(false));
        }

        @Test
        @DisplayName("givenWrongCode_whenVerifyLogin_thenReturn401")
        void givenWrongCode_whenVerifyLogin_thenReturn401() throws Exception {
            when(verifyLoginCodeUseCase.verify("carolina.mendoza", "000000"))
                    .thenThrow(new UnauthorizedException("Invalid or expired code"));

            mockMvc.perform(post("/api/v1/auth/login/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"identifier":"carolina.mendoza","code":"000000"}"""))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("givenPassword_whenRequestEnable_thenReturn202WithMaskedEmail")
        void givenPassword_whenRequestEnable_thenReturn202WithMaskedEmail() throws Exception {
            when(manageTwoFactorUseCase.requestEnable(userId, "Secret123")).thenReturn("c***@example.com");

            mockMvc.perform(post("/api/v1/auth/two-factor/enable")
                            .requestAttr("X-User-Id", userId.toString())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"password":"Secret123"}"""))
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.twoFactorEnabled").value(false))
                    .andExpect(jsonPath("$.maskedEmail").value("c***@example.com"));
        }

        @Test
        @DisplayName("givenCode_whenConfirm_thenTwoFactorIsEnabled")
        void givenCode_whenConfirm_thenTwoFactorIsEnabled() throws Exception {
            mockMvc.perform(post("/api/v1/auth/two-factor/confirm")
                            .requestAttr("X-User-Id", userId.toString())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"code":"123456"}"""))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.twoFactorEnabled").value(true));
            verify(manageTwoFactorUseCase).confirmEnable(userId, "123456");
        }

        @Test
        @DisplayName("givenNoSession_whenRequestEnable_thenReturn401")
        void givenNoSession_whenRequestEnable_thenReturn401() throws Exception {
            mockMvc.perform(post("/api/v1/auth/two-factor/enable")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"password":"Secret123"}"""))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("givenPassword_whenDisable_thenTwoFactorIsOff")
        void givenPassword_whenDisable_thenTwoFactorIsOff() throws Exception {
            mockMvc.perform(post("/api/v1/auth/two-factor/disable")
                            .requestAttr("X-User-Id", userId.toString())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"password":"Secret123"}"""))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.twoFactorEnabled").value(false));
            verify(manageTwoFactorUseCase).disable(userId, "Secret123");
        }
    }

    @Nested
    @DisplayName("POST /api/v1/auth/login")
    class LoginTests {

        @Test
        @DisplayName("givenValidCredentials_whenLogin_thenReturn200SessionJson")
        void givenValidCredentials_whenLogin_thenReturn200SessionJson() throws Exception {
            // Arrange
            when(authenticateUserUseCase.authenticate(eq("carolina.mendoza"), eq("Secret123"), any()))
                    .thenReturn(session);

            // Act & Assert
            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"identifier":"carolina.mendoza","password":"Secret123"}"""))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.sessionId").value(sessionId.toString()))
                    .andExpect(jsonPath("$.userId").value(userId.toString()))
                    .andExpect(jsonPath("$.sessionStatus").value("Active"))
                    .andExpect(jsonPath("$.sourceIp").value("10.0.0.5"))
                    .andExpect(jsonPath("$.startDate").exists());
        }

        @Test
        @DisplayName("givenEmptyBody_whenLogin_thenReturn400ValidationError")
        void givenEmptyBody_whenLogin_thenReturn400ValidationError() throws Exception {
            // Act & Assert: body sin credenciales -> @Valid falla (identifier/password @NotBlank)
            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("identifier")));
        }

        @Test
        @DisplayName("givenMalformedJson_whenLogin_thenReturn400ValidationError")
        void givenMalformedJson_whenLogin_thenReturn400ValidationError() throws Exception {
            // Act & Assert
            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(""))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.message").value("Malformed request body"));
        }

        @Test
        @DisplayName("givenInvalidCredentials_whenLogin_thenReturn401Unauthorized")
        void givenInvalidCredentials_whenLogin_thenReturn401Unauthorized() throws Exception {
            // Arrange
            when(authenticateUserUseCase.authenticate(eq("carolina.mendoza"), eq("wrong"), any()))
                    .thenThrow(new UnauthorizedException("Invalid credentials"));

            // Act & Assert
            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"identifier":"carolina.mendoza","password":"wrong"}"""))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
                    .andExpect(jsonPath("$.message").value("Invalid credentials"));
        }

        @Test
        @DisplayName("givenLockedAccount_whenLogin_thenReturn423WithRetryAfterHeader")
        void givenLockedAccount_whenLogin_thenReturn423WithRetryAfterHeader() throws Exception {
            // Arrange
            when(authenticateUserUseCase.authenticate(eq("carolina.mendoza"), eq("Secret123"), any()))
                    .thenThrow(new AccountLockedException(Duration.ofMinutes(30)));

            // Act & Assert
            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"identifier":"carolina.mendoza","password":"Secret123"}"""))
                    .andExpect(status().isLocked())
                    .andExpect(header().string("Retry-After", "1800"))
                    .andExpect(jsonPath("$.error").value("ACCOUNT_LOCKED"))
                    .andExpect(jsonPath("$.status").value(423));
        }

        @Test
        @DisplayName("givenTooManyFailuresFromOneIp_whenLogin_thenReturn429WithRetryAfter")
        void givenTooManyFailuresFromOneIp_whenLogin_thenReturn429WithRetryAfter() throws Exception {
            when(authenticateUserUseCase.authenticate(eq("carolina.mendoza"), eq("Secret123"), eq("203.0.113.7")))
                    .thenThrow(new com.faceattend_edu.identity_service.domain.exception.TooManyLoginAttemptsException(Duration.ofSeconds(42)));

            mockMvc.perform(post("/api/v1/auth/login")
                            .header("X-Real-IP", "203.0.113.7")
                            .header("X-Forwarded-For", "198.51.100.1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"identifier":"carolina.mendoza","password":"Secret123"}"""))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(header().string("Retry-After", "42"))
                    .andExpect(jsonPath("$.error").value("TOO_MANY_ATTEMPTS"));
        }
    }

    @Nested
    @DisplayName("POST /api/v1/auth/refresh")
    class RefreshTests {

        @Test
        @DisplayName("givenActiveSession_whenRefresh_thenReturn200NewSession")
        void givenActiveSession_whenRefresh_thenReturn200NewSession() throws Exception {
            // Arrange
            when(refreshSessionUseCase.refresh(eq(sessionId), anyString())).thenReturn(session);

            // Act & Assert
            mockMvc.perform(post("/api/v1/auth/refresh")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"sessionId\":\"" + sessionId + "\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.sessionId").value(sessionId.toString()))
                    .andExpect(jsonPath("$.sessionStatus").value("Active"));
        }

        @Test
        @DisplayName("givenUnknownOrClosedSession_whenRefresh_thenReturn401")
        void givenUnknownOrClosedSession_whenRefresh_thenReturn401() throws Exception {
            // Arrange
            when(refreshSessionUseCase.refresh(eq(sessionId), anyString()))
                    .thenThrow(new UnauthorizedException("Invalid session"));

            // Act & Assert
            mockMvc.perform(post("/api/v1/auth/refresh")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"sessionId\":\"" + sessionId + "\"}"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        }
    }

    @Nested
    @DisplayName("POST /api/v1/auth/logout y GET /api/v1/auth/me")
    class LogoutAndMeTests {

        @Test
        @DisplayName("givenSessionId_whenLogout_thenReturn204AndClosesSession")
        void givenSessionId_whenLogout_thenReturn204AndClosesSession() throws Exception {
            // Act & Assert
            mockMvc.perform(post("/api/v1/auth/logout")
                            .param("sessionId", sessionId.toString()))
                    .andExpect(status().isNoContent());

            verify(closeUserSessionUseCase).closeSession(sessionId);
        }

        @Test
        @DisplayName("givenUsername_whenMe_thenReturn200UserJson")
        void givenUsername_whenMe_thenReturn200UserJson() throws Exception {
            // Arrange
            User user = new User();
            user.setUserId(userId);
            user.setUsername("carolina.mendoza");
            user.setAuthenticationType("Local");
            user.setStatus(true);
            when(getUserByUsernameUseCase.getUserByUsername("carolina.mendoza")).thenReturn(user);

            // Act & Assert
            mockMvc.perform(get("/api/v1/auth/me").param("username", "carolina.mendoza").requestAttr("X-User-Id", userId.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.userId").value(userId.toString()))
                    .andExpect(jsonPath("$.username").value("carolina.mendoza"))
                    .andExpect(jsonPath("$.authenticationType").value("Local"))
                    .andExpect(jsonPath("$.status").value(true));
        }

        @Test
        @DisplayName("givenEmail_whenMe_thenReturn200UsingEmailAsIdentifier")
        void givenEmail_whenMe_thenReturn200UsingEmailAsIdentifier() throws Exception {
            // Arrange: /me acepta username o email; el email viaja tal cual al caso de uso
            User user = new User();
            user.setUserId(userId);
            user.setUsername("carolina.mendoza");
            when(getUserByUsernameUseCase.getUserByUsername("carolina@example.com")).thenReturn(user);

            // Act & Assert
            mockMvc.perform(get("/api/v1/auth/me").param("email", "carolina@example.com").requestAttr("X-User-Id", userId.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.username").value("carolina.mendoza"));
        }

        @Test
        @DisplayName("givenNoIdentifier_whenMe_thenReturn400ValidationError")
        void givenNoIdentifier_whenMe_thenReturn400ValidationError() throws Exception {
            // Act & Assert
            mockMvc.perform(get("/api/v1/auth/me").requestAttr("X-User-Id", userId.toString()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.message").value("username or email is required"));
        }

        @Test
        @DisplayName("givenNoSession_whenMe_thenReturn401")
        void givenNoSession_whenMe_thenReturn401() throws Exception {
            mockMvc.perform(get("/api/v1/auth/me").param("username", "carolina.mendoza"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("givenAnotherUsersIdentifier_whenMe_thenReturn404WithoutLeakingData")
        void givenAnotherUsersIdentifier_whenMe_thenReturn404WithoutLeakingData() throws Exception {
            User other = new User();
            other.setUserId(UUID.randomUUID());
            other.setUsername("someone.else");
            when(getUserByUsernameUseCase.getUserByUsername("someone.else")).thenReturn(other);

            mockMvc.perform(get("/api/v1/auth/me").param("username", "someone.else")
                            .requestAttr("X-User-Id", userId.toString()))
                    .andExpect(status().isNotFound());
        }
    }
}
