package com.faceattend_edu.shared.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class SessionAuthClientTest {

    private static final String TOKEN = "11111111-2222-3333-4444-555555555555";
    private static final String USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    private static final String SESSION_URL = "http://identity/api/v1/sessions/" + TOKEN;
    private static final String ROLES_URL = "http://authorization/api/v1/users/" + USER + "/roles";

    private MockRestServiceServer server;
    private SessionAuthClient client;

    @BeforeEach
    void setUp() {
        RestTemplate rest = new RestTemplate();
        server = MockRestServiceServer.bindTo(rest).ignoreExpectOrder(true).build();
        client = new SessionAuthClient(rest, "http://identity", "http://authorization");
    }

    private void activeSession(ExpectedCount count) {
        server.expect(count, requestTo(SESSION_URL)).andExpect(method(HttpMethod.GET))
                .andExpect(header("Authorization", "Bearer " + TOKEN))
                .andRespond(withSuccess("{\"sessionStatus\":\"Active\",\"userId\":\"" + USER + "\"}", MediaType.APPLICATION_JSON));
    }

    private void roles(ExpectedCount count) {
        server.expect(count, requestTo(ROLES_URL))
                .andRespond(withSuccess("[{\"roleName\":\"Instructor\"},{\"role_name\":\"Aprendiz\"}]", MediaType.APPLICATION_JSON));
    }

    @Test
    void missingOrMalformedBearerIsRejectedWithoutCallingIdentity() {
        assertThat(client.authenticate(null).denial()).isEqualTo("Missing bearer token");
        assertThat(client.authenticate("Basic abc").denial()).isEqualTo("Missing bearer token");
        assertThat(client.authenticate("Bearer not-a-uuid").denial()).isEqualTo("Invalid token format");
        server.verify();
    }

    @Test
    void activeSessionResolvesCallerAndRolesAndIsCached() {
        activeSession(ExpectedCount.once());
        roles(ExpectedCount.once());

        SessionAuthClient.AuthResult first = client.authenticate("Bearer " + TOKEN);
        SessionAuthClient.AuthResult second = client.authenticate("bearer " + TOKEN);

        assertThat(first.authenticated()).isTrue();
        assertThat(first.caller().userId()).isEqualTo(USER);
        assertThat(first.caller().roles()).containsExactly("Instructor", "Aprendiz");
        assertThat(second.caller()).isEqualTo(first.caller());
        server.verify();
    }

    @Test
    void sessionOnlyCheckNeverAsksForRoles() {
        // authorization serves the role lookups itself: asking for roles there would call itself.
        activeSession(ExpectedCount.once());

        SessionAuthClient.AuthResult result = client.authenticateSession("Bearer " + TOKEN);

        assertThat(result.authenticated()).isTrue();
        assertThat(result.caller().userId()).isEqualTo(USER);
        assertThat(result.caller().roles()).isEmpty();
        assertThat(client.authenticateSession("Bearer not-a-uuid").denial()).isEqualTo("Invalid token format");
        server.verify();
    }

    @Test
    void inactiveSessionIsRejected() {
        server.expect(requestTo(SESSION_URL))
                .andRespond(withSuccess("{\"sessionStatus\":\"Closed\",\"userId\":\"" + USER + "\"}", MediaType.APPLICATION_JSON));
        assertThat(client.authenticate("Bearer " + TOKEN).denial()).isEqualTo("Invalid or expired session");
        server.verify();
    }

    @Test
    void identityDownTwiceDeniesAndIsNotCached() {
        server.expect(ExpectedCount.times(2), requestTo(SESSION_URL)).andRespond(withServerError());
        assertThat(client.authenticate("Bearer " + TOKEN).authenticated()).isFalse();
        server.verify();

        server.reset();
        activeSession(ExpectedCount.once());
        roles(ExpectedCount.once());
        assertThat(client.authenticate("Bearer " + TOKEN).authenticated()).isTrue();
        server.verify();
    }

    @Test
    void oneTransientFailureIsRetried() {
        server.expect(ExpectedCount.once(), requestTo(SESSION_URL)).andRespond(withServerError());
        activeSession(ExpectedCount.once());
        roles(ExpectedCount.once());
        assertThat(client.authenticate("Bearer " + TOKEN).authenticated()).isTrue();
        server.verify();
    }

    @Test
    void onlyAllowedEvaluationsAreCached() {
        SessionAuthClient.Caller caller = new SessionAuthClient.Caller(USER, List.of("Instructor"), TOKEN);
        String allowUrl = "http://authorization/api/v1/auth/evaluate?userId=" + USER + "&permission=a:read";
        String denyUrl = "http://authorization/api/v1/auth/evaluate?userId=" + USER + "&permission=a:write";
        server.expect(ExpectedCount.once(), requestTo(allowUrl))
                .andRespond(withSuccess("{\"allowed\":true}", MediaType.APPLICATION_JSON));
        server.expect(ExpectedCount.times(2), requestTo(denyUrl))
                .andRespond(withSuccess("{\"allowed\":false}", MediaType.APPLICATION_JSON));

        assertThat(client.isAllowed(caller, "a:read")).isTrue();
        assertThat(client.isAllowed(caller, "a:read")).isTrue();
        assertThat(client.isAllowed(caller, "a:write")).isFalse();
        assertThat(client.isAllowed(caller, "a:write")).isFalse();
        server.verify();
    }

    @Test
    void denyWritesTheSharedJsonShape() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        SessionAuthClient.deny(response, 403, "Forbidden: requires \"x\"", "/api/v1/a");
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).isEqualTo(
                "{\"status\":403,\"error\":\"Forbidden\",\"message\":\"Forbidden: requires 'x'\",\"path\":\"/api/v1/a\"}");
    }

    @Test
    void propagateExposesCallerToControllers() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        try {
            SessionAuthClient.propagate(request, response,
                    new SessionAuthClient.Caller(USER, List.of("Super Administrador"), TOKEN));
            assertThat(request.getAttribute("X-User-Id")).isEqualTo(USER);
            assertThat(response.getHeader("X-User-Roles")).isEqualTo("Super Administrador");
            assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
                    .extracting(Object::toString).containsExactly("ROLE_SUPER ADMINISTRADOR");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void onlyHealthIsPublic() {
        assertThat(SessionAuthClient.isPublicPrefix("/actuator/health")).isTrue();
        assertThat(SessionAuthClient.isPublicPrefix("/api/v1/health")).isTrue();
        assertThat(SessionAuthClient.isPublicPrefix("/actuator/env")).isFalse();
        assertThat(SessionAuthClient.isPublicPrefix("/v3/api-docs")).isFalse();
        assertThat(SessionAuthClient.isPublicPrefix("/api/v1/persons")).isFalse();
    }

    @Test
    void sessionOnlyNeverAsksAuthorizationForRoles() {
        activeSession(ExpectedCount.once());

        SessionAuthClient.AuthResult first = client.authenticateSession("Bearer " + TOKEN);
        SessionAuthClient.AuthResult second = client.authenticateSession("Bearer " + TOKEN);

        assertThat(first.authenticated()).isTrue();
        assertThat(first.caller().userId()).isEqualTo(USER);
        assertThat(first.caller().roles()).isEmpty();
        assertThat(second.caller()).isEqualTo(first.caller());
        assertThat(client.authenticateSession(null).denial()).isEqualTo("Missing bearer token");
        server.verify();
    }

    @Test
    void fullAuthenticationAfterASessionOnlyCheckStillResolvesRoles() {
        activeSession(ExpectedCount.once());
        roles(ExpectedCount.once());

        client.authenticateSession("Bearer " + TOKEN);
        SessionAuthClient.AuthResult full = client.authenticate("Bearer " + TOKEN);

        assertThat(full.caller().roles()).containsExactly("Instructor", "Aprendiz");
        server.verify();
    }

    @Test
    void requestPathIsDecodedLikeSpringMvcDoes() {
        assertThat(SessionAuthClient.requestPath(request("/api/v1/roles"))).isEqualTo("/api/v1/roles");
        assertThat(SessionAuthClient.requestPath(request("/%61pi/v1/%72oles"))).isEqualTo("/api/v1/roles");
        assertThat(SessionAuthClient.requestPath(request("/api/v1/roles;jsessionid=abc"))).isEqualTo("/api/v1/roles");
        assertThat(SessionAuthClient.isPublicPrefix(SessionAuthClient.requestPath(request("/%68ealth")))).isTrue();
        assertThat(SessionAuthClient.isPublicPrefix(SessionAuthClient.requestPath(request("/%61pi/v1/persons")))).isFalse();
    }

    private static MockHttpServletRequest request(String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
        request.setRequestURI(uri);
        return request;
    }
}
