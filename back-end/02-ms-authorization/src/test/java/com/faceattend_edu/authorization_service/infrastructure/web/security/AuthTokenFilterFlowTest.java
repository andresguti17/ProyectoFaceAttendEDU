package com.faceattend_edu.authorization_service.infrastructure.web.security;

import com.faceattend_edu.authorization_service.domain.port.in.CheckPermissionUseCase;
import com.faceattend_edu.shared.auth.SessionAuthClient;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The whole request flow of the authorization service's filter: session check, then
 * RBAC-on-RBAC (role and permission catalog writes need the Super Administrador role),
 * then the permission of each route. Identity and authorization answers are mocked.
 */
@DisplayName("AuthTokenFilter request flow")
class AuthTokenFilterFlowTest {

    private static final String SUPER_TOKEN = "11111111-1111-4111-8111-111111111111";
    private static final String ADMIN_TOKEN = "22222222-2222-4222-8222-222222222222";
    private static final String SUPER_USER = "aaaaaaaa-0000-4000-8000-000000000001";
    private static final String ADMIN_USER = "aaaaaaaa-0000-4000-8000-000000000002";

    private AuthTokenFilter filter;
    private Set<String> allowed;
    private List<String> rolesFetched;

    @BeforeEach
    @SuppressWarnings({"unchecked", "rawtypes"})
    void setUp() {
        allowed = Set.of(SUPER_USER + "|configuration:manage");
        RestTemplate rest = mock(RestTemplate.class);
        when(rest.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class))).thenAnswer(inv -> {
            String url = inv.getArgument(0);
            if (url.contains("/sessions/")) {
                String user = url.endsWith(SUPER_TOKEN) ? SUPER_USER : ADMIN_USER;
                return ResponseEntity.ok(Map.of("sessionStatus", "Active", "userId", user));
            }
            String user = url.replaceAll(".*userId=([^&]+).*", "$1");
            String permission = url.replaceAll(".*permission=", "");
            return ResponseEntity.ok(Map.of("allowed", allowed.contains(user + "|" + permission)));
        });
        rolesFetched = new ArrayList<>();
        when(rest.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(List.class))).thenAnswer(inv -> {
            String url = inv.getArgument(0);
            rolesFetched.add(url);
            String role = url.contains(SUPER_USER) ? "Super Administrador" : "Administrador";
            return ResponseEntity.ok(List.of(Map.of("roleName", role)));
        });
        CheckPermissionUseCase inProcess = (userId, permission) -> allowed.contains(userId + "|" + permission);
        ObjectProvider<CheckPermissionUseCase> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(inProcess);
        filter = new AuthTokenFilter(provider, "http://identity", "http://authorization");
        ReflectionTestUtils.setField(filter, "sessionAuth", new SessionAuthClient(rest, "http://identity", "http://authorization"));
    }

    private MockHttpServletResponse run(String method, String path, String token, FilterChain chain) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRequestURI(path);
        if (token != null) request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        return response;
    }

    @Test
    void nonApiAndHealthPathsPassWithoutASession() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        assertThat(run("GET", "/actuator/health", null, chain).getStatus()).isEqualTo(200);
        assertThat(run("GET", "/api/v1/health", null, chain).getStatus()).isEqualTo(200);
    }

    @Test
    void rolesAndEvaluatePrimitivesNeedASession() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        assertThat(run("GET", "/api/v1/auth/evaluate", null, chain).getStatus()).isEqualTo(401);
        assertThat(run("GET", "/api/v1/users/" + ADMIN_USER + "/roles", null, chain).getStatus()).isEqualTo(401);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void ownPrimitivesPassWithASessionWithoutCallingThisServiceAgain() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        assertThat(run("GET", "/api/v1/users/" + ADMIN_USER + "/roles", ADMIN_TOKEN, chain).getStatus()).isEqualTo(200);
        assertThat(evaluate(ADMIN_USER.toUpperCase(), ADMIN_TOKEN, chain).getStatus()).isEqualTo(200);
        assertThat(rolesFetched).isEmpty();
    }

    @Test
    void anotherUsersPrimitivesNeedConfigurationManageEvaluatedInProcess() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse denied = run("GET", "/api/v1/users/" + SUPER_USER + "/roles", ADMIN_TOKEN, chain);
        assertThat(denied.getStatus()).isEqualTo(403);
        assertThat(denied.getContentAsString()).contains("requires configuration:manage");
        assertThat(evaluate(SUPER_USER, ADMIN_TOKEN, chain).getStatus()).isEqualTo(403);
        verify(chain, never()).doFilter(any(), any());

        assertThat(run("GET", "/api/v1/users/" + ADMIN_USER + "/roles", SUPER_TOKEN, chain).getStatus()).isEqualTo(200);
        assertThat(evaluate(ADMIN_USER, SUPER_TOKEN, chain).getStatus()).isEqualTo(200);
        assertThat(rolesFetched).isEmpty();
    }

    private MockHttpServletResponse evaluate(String userId, String token, FilterChain chain) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/evaluate");
        request.setRequestURI("/api/v1/auth/evaluate");
        request.setParameter("userId", userId);
        request.setParameter("permission", "x:read");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        return response;
    }

    @Test
    void anythingElseNeedsAValidBearer() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = run("GET", "/api/v1/roles", null, chain);
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("Missing bearer token");
        assertThat(run("POST", "/api/v1/roles", "not-a-session", chain).getStatus()).isEqualTo(401);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void aSchoolAdministradorCannotRewriteTheRoleOrPermissionCatalog() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse roles = run("POST", "/api/v1/roles", ADMIN_TOKEN, chain);
        assertThat(roles.getStatus()).isEqualTo(403);
        assertThat(roles.getContentAsString()).contains("requires Super Administrador");
        assertThat(run("PUT", "/api/v1/permissions/3", ADMIN_TOKEN, chain).getStatus()).isEqualTo(403);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void superAdministradorWritesTheCatalogAndIsPropagatedToControllers() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/roles");
        request.setRequestURI("/api/v1/roles");
        request.addHeader("Authorization", "Bearer " + SUPER_TOKEN);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(request.getAttribute("X-User-Id")).isEqualTo(SUPER_USER);
        assertThat(response.getHeader("X-User-Roles")).isEqualTo("Super Administrador");
        verify(chain).doFilter(any(), any());
    }

    @Test
    void readingTheCatalogNeedsConfigurationManage() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = run("GET", "/api/v1/roles", ADMIN_TOKEN, chain);
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("requires configuration:manage");
        assertThat(run("GET", "/api/v1/roles", SUPER_TOKEN, chain).getStatus()).isEqualTo(200);
    }

    @Test
    void anotherUsersRoleAssignmentNeedsConfigurationManageButOwnDoesNot() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        assertThat(run("POST", "/api/v1/users/" + SUPER_USER + "/roles", ADMIN_TOKEN, chain).getStatus()).isEqualTo(403);
        assertThat(run("DELETE", "/api/v1/users/" + ADMIN_USER + "/roles/2", ADMIN_TOKEN, chain).getStatus()).isEqualTo(200);
    }

    @Test
    void evaluatingAnotherUserByPostNeedsConfigurationManage() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/evaluate");
        request.setRequestURI("/api/v1/auth/evaluate");
        request.setParameter("userId", SUPER_USER);
        request.addHeader("Authorization", "Bearer " + ADMIN_TOKEN);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        assertThat(response.getStatus()).isEqualTo(403);

        MockHttpServletRequest own = new MockHttpServletRequest("POST", "/api/v1/auth/evaluate");
        own.setRequestURI("/api/v1/auth/evaluate");
        own.setParameter("userId", ADMIN_USER);
        own.addHeader("Authorization", "Bearer " + ADMIN_TOKEN);
        MockHttpServletResponse ownResponse = new MockHttpServletResponse();
        filter.doFilter(own, ownResponse, chain);
        assertThat(ownResponse.getStatus()).isEqualTo(200);
    }

    @Test
    void aPercentEncodedPathCannotDodgeTheSessionOrTheSuperAdministradorRule() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        assertThat(run("GET", "/%61pi/v1/roles", null, chain).getStatus()).isEqualTo(401);
        assertThat(run("GET", "/%61pi/v1/auth/evaluate", null, chain).getStatus()).isEqualTo(401);

        MockHttpServletResponse catalog = run("POST", "/api/v1/%72oles", ADMIN_TOKEN, chain);
        assertThat(catalog.getStatus()).isEqualTo(403);
        assertThat(catalog.getContentAsString()).contains("requires Super Administrador");
        verify(chain, never()).doFilter(any(), any());
    }
}
