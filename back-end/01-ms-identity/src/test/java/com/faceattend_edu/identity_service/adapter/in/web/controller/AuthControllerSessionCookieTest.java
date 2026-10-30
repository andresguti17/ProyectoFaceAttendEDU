package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.SessionCookie;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.UserSessionWebMapper;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.UserWebMapper;
import com.faceattend_edu.identity_service.application.port.in.AuthenticateUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.CloseUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.GetUserByUsernameUseCase;
import com.faceattend_edu.identity_service.application.port.in.GetUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.ManageTwoFactorUseCase;
import com.faceattend_edu.identity_service.application.port.in.RefreshSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.VerifyLoginCodeUseCase;
import com.faceattend_edu.identity_service.config.AuthProperties;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.TwoFactorRequiredException;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * S-10: the web keeps its session in an HttpOnly cookie. The cookie is only used when the client asks for it with
 * {@code X-Session-Mode: cookie}; without that header every endpoint answers exactly as before (mobile, scripts).
 */
@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({UserSessionWebMapper.class, UserWebMapper.class, SessionCookie.class, AuthProperties.class})
@DisplayName("AuthController web session cookie (S-10)")
class AuthControllerSessionCookieTest {

    private static final String LOGIN = """
            {"identifier":"carolina.mendoza","password":"Secret123"}""";

    @Autowired private MockMvc mockMvc;

    @MockitoBean private AuthenticateUserUseCase authenticateUserUseCase;
    @MockitoBean private CloseUserSessionUseCase closeUserSessionUseCase;
    @MockitoBean private GetUserByUsernameUseCase getUserByUsernameUseCase;
    @MockitoBean private RefreshSessionUseCase refreshSessionUseCase;
    @MockitoBean private VerifyLoginCodeUseCase verifyLoginCodeUseCase;
    @MockitoBean private ManageTwoFactorUseCase manageTwoFactorUseCase;
    @MockitoBean private GetUserSessionUseCase getUserSessionUseCase;

    private UserSession session;
    private UUID sessionId;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername("carolina.mendoza");
        user.setStatus(true);
        sessionId = UUID.randomUUID();
        session = new UserSession();
        session.setSessionId(sessionId);
        session.setUserId(user);
        session.setSourceIp("10.0.0.5");
        session.start();
    }

    private UserSession renewed() {
        UserSession next = new UserSession();
        next.setSessionId(UUID.randomUUID());
        next.setUserId(session.getUserId());
        next.start();
        return next;
    }

    @Test
    @DisplayName("login without the mode header keeps the id in the body and sets no cookie")
    void loginWithoutModeKeepsTheBody() throws Exception {
        when(authenticateUserUseCase.authenticate(eq("carolina.mendoza"), eq("Secret123"), any())).thenReturn(session);

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value(sessionId.toString()))
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
    }

    @Test
    @DisplayName("login with X-Session-Mode: cookie sets an HttpOnly cookie and drops the id from the body")
    void loginInCookieMode() throws Exception {
        when(authenticateUserUseCase.authenticate(eq("carolina.mendoza"), eq("Secret123"), any())).thenReturn(session);

        mockMvc.perform(post("/api/v1/auth/login").header("X-Session-Mode", "cookie")
                        .contentType(MediaType.APPLICATION_JSON).content(LOGIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").doesNotExist())
                .andExpect(jsonPath("$.userId").exists())
                .andExpect(jsonPath("$.sessionStatus").value("Active"))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("fae_session=" + sessionId)))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("HttpOnly")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Secure")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("SameSite=Lax")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Path=/api/v1")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=28800")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, not(containsString("Domain"))));
    }

    @Test
    @DisplayName("a two-factor challenge has no session, so no cookie either")
    void twoFactorChallengeSetsNoCookie() throws Exception {
        when(authenticateUserUseCase.authenticate(eq("carolina.mendoza"), eq("Secret123"), any()))
                .thenThrow(new TwoFactorRequiredException("c***@example.com"));

        mockMvc.perform(post("/api/v1/auth/login").header("X-Session-Mode", "cookie")
                        .contentType(MediaType.APPLICATION_JSON).content(LOGIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.twoFactorRequired").value(true))
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
    }

    @Test
    @DisplayName("the code that finishes a two-factor login also sets the cookie in cookie mode")
    void verifyLoginInCookieMode() throws Exception {
        when(verifyLoginCodeUseCase.verify("carolina.mendoza", "123456")).thenReturn(session);

        mockMvc.perform(post("/api/v1/auth/login/verify").header("X-Session-Mode", "cookie")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifier":"carolina.mendoza","code":"123456"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").doesNotExist())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("fae_session=" + sessionId)));
    }

    @Test
    @DisplayName("refresh with the id in the body (mobile) is unchanged")
    void refreshWithBodyIsUnchanged() throws Exception {
        UserSession next = renewed();
        when(refreshSessionUseCase.refresh(eq(sessionId), any())).thenReturn(next);

        mockMvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"" + sessionId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value(next.getSessionId().toString()))
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
    }

    @Test
    @DisplayName("refresh with no body renews the session in the cookie and sets the new one")
    void refreshFromTheCookie() throws Exception {
        UserSession next = renewed();
        when(refreshSessionUseCase.refresh(eq(sessionId), any())).thenReturn(next);

        mockMvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("fae_session", sessionId.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").doesNotExist())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("fae_session=" + next.getSessionId())))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("HttpOnly")));
    }

    @Test
    @DisplayName("refresh with neither a body id nor a cookie is a 400")
    void refreshWithoutAnySessionIsABadRequest() throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        verify(refreshSessionUseCase, never()).refresh(any(), any());
    }

    @Test
    @DisplayName("logout with a Bearer (mobile) closes the session and does not touch cookies")
    void logoutWithBearerLeavesCookiesAlone() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout").header(HttpHeaders.AUTHORIZATION, "Bearer " + sessionId))
                .andExpect(status().isNoContent())
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
        verify(closeUserSessionUseCase).closeSession(sessionId);
    }

    @Test
    @DisplayName("logout from the cookie closes that session and expires the cookie")
    void logoutFromTheCookieClearsIt() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout").cookie(new Cookie("fae_session", sessionId.toString())))
                .andExpect(status().isNoContent())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("fae_session=;")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Path=/api/v1")));
        verify(closeUserSessionUseCase).closeSession(sessionId);
    }

    @Test
    @DisplayName("a cookie that is not a UUID is ignored")
    void garbageCookieIsIgnored() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout").cookie(new Cookie("fae_session", "not-a-uuid")))
                .andExpect(status().isBadRequest());
        verify(closeUserSessionUseCase, never()).closeSession(any());
    }

    @Test
    @DisplayName("GET /auth/session tells who the Bearer session is and never returns its id")
    void sessionByBearer() throws Exception {
        when(getUserSessionUseCase.getUserSession(sessionId)).thenReturn(session);

        mockMvc.perform(get("/api/v1/auth/session").header(HttpHeaders.AUTHORIZATION, "Bearer " + sessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").doesNotExist())
                .andExpect(jsonPath("$.userId").exists())
                .andExpect(jsonPath("$.sessionStatus").value("Active"))
                .andExpect(jsonPath("$.mustChangePassword").value(false));
    }

    @Test
    @DisplayName("GET /auth/session falls back to the cookie when there is no Authorization header")
    void sessionByCookie() throws Exception {
        when(getUserSessionUseCase.getUserSession(sessionId)).thenReturn(session);

        mockMvc.perform(get("/api/v1/auth/session").cookie(new Cookie("fae_session", sessionId.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").doesNotExist());
    }

    @Test
    @DisplayName("GET /auth/session is a 401 with no session, an unknown one or one that is no longer active")
    void sessionRejectsWhatIsNotAnActiveSession() throws Exception {
        mockMvc.perform(get("/api/v1/auth/session")).andExpect(status().isUnauthorized());

        UUID unknown = UUID.randomUUID();
        when(getUserSessionUseCase.getUserSession(unknown)).thenThrow(new EntityNotFoundException("UserSession", unknown));
        mockMvc.perform(get("/api/v1/auth/session").header(HttpHeaders.AUTHORIZATION, "Bearer " + unknown))
                .andExpect(status().isUnauthorized());

        UserSession closed = renewed();
        closed.setSessionStatus("Closed");
        when(getUserSessionUseCase.getUserSession(closed.getSessionId())).thenReturn(closed);
        mockMvc.perform(get("/api/v1/auth/session").header(HttpHeaders.AUTHORIZATION, "Bearer " + closed.getSessionId()))
                .andExpect(status().isUnauthorized());
    }
}
