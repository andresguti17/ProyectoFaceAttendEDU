package com.faceattend_edu.scheduling_service.infrastructure.web.security;

import com.faceattend_edu.scheduling_service.infrastructure.web.security.CallerSchoolResolver.CallerSchool;
import com.faceattend_edu.shared.auth.SessionAuthClient;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("Scheduling AuthTokenFilter request flow")
class AuthTokenFilterFlowTest {

    private static final String TOKEN = "11111111-1111-4111-8111-111111111111";
    private static final String USER = "aaaaaaaa-0000-4000-8000-000000000002";

    private AuthTokenFilter filter;
    private CallerSchoolResolver resolver;
    private Set<String> allowed;

    @BeforeEach
    @SuppressWarnings({"unchecked", "rawtypes"})
    void setUp() {
        allowed = Set.of("attendance.record:read", "scheduling.session:manage");
        RestTemplate rest = mock(RestTemplate.class);
        when(rest.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class))).thenAnswer(inv -> {
            String url = inv.getArgument(0);
            if (url.contains("/sessions/")) return ResponseEntity.ok(Map.of("sessionStatus", "Active", "userId", USER));
            return ResponseEntity.ok(Map.of("allowed", allowed.contains(url.replaceAll(".*permission=", ""))));
        });
        when(rest.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(List.class)))
                .thenReturn(ResponseEntity.ok(List.of(Map.of("roleName", "Instructor"))));
        resolver = mock(CallerSchoolResolver.class);
        ObjectProvider<CallerSchoolResolver> provider =
                new StaticListableBeanFactory(Map.of("resolver", resolver)).getBeanProvider(CallerSchoolResolver.class);
        filter = new AuthTokenFilter(provider, "http://identity", "http://authorization");
        ReflectionTestUtils.setField(filter, "sessionAuth", new SessionAuthClient(rest, "http://identity", "http://authorization"));
    }

    private MockHttpServletRequest request(String method, String path, boolean withToken) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRequestURI(path);
        if (withToken) request.addHeader("Authorization", "Bearer " + TOKEN);
        return request;
    }

    @Test
    void healthAndDocsPassAndApiCallsNeedASession() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse ok = new MockHttpServletResponse();
        filter.doFilter(request("GET", "/v3/api-docs", false), ok, chain);
        assertThat(ok.getStatus()).isEqualTo(200);
        MockHttpServletResponse denied = new MockHttpServletResponse();
        filter.doFilter(request("GET", "/api/v1/class-sessions", false), denied, chain);
        assertThat(denied.getStatus()).isEqualTo(401);
    }

    @Test
    void anInstructorReadsAndManagesSessionsWithItsSchoolAttached() throws Exception {
        CallerSchool school = new CallerSchool(false, 1, 7L);
        when(resolver.resolve(eq(USER), anyList(), eq(TOKEN))).thenReturn(school);
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletRequest read = request("GET", "/api/v1/class-sessions", true);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(read, response, chain);
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(read.getAttribute(AuthTokenFilter.CALLER_SCHOOL_ATTRIBUTE)).isEqualTo(school);
        assertThat(read.getAttribute("X-User-Id")).isEqualTo(USER);

        MockHttpServletResponse open = new MockHttpServletResponse();
        filter.doFilter(request("POST", "/api/v1/class-sessions/9/open", true), open, chain);
        assertThat(open.getStatus()).isEqualTo(200);
    }

    @Test
    void environmentsAndBlocksNeedSchoolManagement() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request("POST", "/api/v1/environments", true), response, chain);
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("academic.school:manage");
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void anUnresolvableSchoolFailsClosedWith503() throws Exception {
        when(resolver.resolve(eq(USER), anyList(), eq(TOKEN))).thenThrow(new IllegalStateException("academic down"));
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request("GET", "/api/v1/class-sessions", true), response, chain);
        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(response.getContentAsString()).contains("Cannot resolve caller school");
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void aPercentEncodedPathIsJudgedLikeTheDecodedOneTheControllerRuns() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse noSession = new MockHttpServletResponse();
        filter.doFilter(request("GET", "/%61pi/v1/class-sessions", false), noSession, chain);
        assertThat(noSession.getStatus()).isEqualTo(401);

        // An instructor holds scheduling.session:manage but not academic.school:manage:
        // encoding "environments" must not downgrade the permission the route needs.
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request("POST", "/api/v1/%65nvironments", true), response, chain);
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("academic.school:manage");
        verify(chain, never()).doFilter(any(), any());
    }
}
