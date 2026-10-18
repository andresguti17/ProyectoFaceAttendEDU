package com.faceattend_edu.identity_service.adapter.in.web.security;

import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import jakarta.servlet.FilterChain;
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
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Escrituras de un Administrador de sede sobre personas/cuentas de otra sede: 403. */
class AuthTokenFilterWriteScopeTest {

    private static final UUID ADMIN_USER = UUID.fromString("a0000000-0000-4000-8000-000000000001");
    private static final UUID ADMIN_PERSON = UUID.fromString("a0000000-0000-4000-8000-0000000000a1");
    private static final UUID SAME_SCHOOL_PERSON = UUID.fromString("b0000000-0000-4000-8000-0000000000b1");
    private static final UUID OTHER_SCHOOL_PERSON = UUID.fromString("c0000000-0000-4000-8000-0000000000c1");
    private static final UUID OTHER_SCHOOL_USER = UUID.fromString("c0000000-0000-4000-8000-0000000000c2");
    private static final UUID CREATED_BY_ADMIN = UUID.fromString("e0000000-0000-4000-8000-0000000000e1");
    private static final String TOKEN = "d0000000-0000-4000-8000-000000000001";

    private AuthTokenFilter filter() {
        LoadUserPort users = id -> {
            User u = new User();
            u.setUserId(id);
            Person p = new Person();
            p.setPersonId(OTHER_SCHOOL_USER.equals(id) ? OTHER_SCHOOL_PERSON : ADMIN_PERSON);
            u.setPersonId(p);
            return u;
        };
        ObjectProvider<LoadUserPort> userProvider =
                new StaticListableBeanFactory(Map.of("users", users)).getBeanProvider(LoadUserPort.class);
        CallerScopeResolver resolver = new CallerScopeResolver(userProvider) {
            @Override
            public Scope resolve(String userId, List<String> roles, String token) {
                return new Scope(Set.of(ADMIN_PERSON, SAME_SCHOOL_PERSON));
            }
        };
        ObjectProvider<CallerScopeResolver> resolverProvider =
                new StaticListableBeanFactory(Map.of("resolver", resolver)).getBeanProvider(CallerScopeResolver.class);

        LoadPersonPort persons = id -> {
            Person p = new Person();
            p.setPersonId(id);
            if (CREATED_BY_ADMIN.equals(id)) p.setCreatedBy(ADMIN_USER);
            return p;
        };
        ObjectProvider<LoadPersonPort> personProvider =
                new StaticListableBeanFactory(Map.of("persons", persons)).getBeanProvider(LoadPersonPort.class);
        AuthTokenFilter filter = new AuthTokenFilter(userProvider, resolverProvider, personProvider);
        RestTemplate rest = mock(RestTemplate.class);
        when(rest.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class))).thenAnswer(inv -> {
            String url = inv.getArgument(0);
            if (url.contains("/sessions/")) {
                return ResponseEntity.ok(Map.of("sessionStatus", "Active", "userId", ADMIN_USER.toString()));
            }
            return ResponseEntity.ok(Map.of("allowed", true));
        });
        when(rest.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(List.class)))
                .thenReturn(ResponseEntity.ok(List.of(Map.of("roleName", "Administrador"))));
        ReflectionTestUtils.setField(filter, "restTemplate", rest);
        return filter;
    }

    private MockHttpServletResponse run(String method, String path, FilterChain chain) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.addHeader("Authorization", "Bearer " + TOKEN);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter().doFilter(request, response, chain);
        return response;
    }

    @Test
    void putOnPersonOutsideTheSchoolIsForbidden() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = run("PUT", "/api/v1/persons/" + OTHER_SCHOOL_PERSON, chain);
        assertEquals(403, response.getStatus());
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void patchPersonStatusOutsideTheSchoolIsForbidden() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        assertEquals(403, run("PATCH", "/api/v1/persons/" + OTHER_SCHOOL_PERSON + "/status", chain).getStatus());
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void userWritesOutsideTheSchoolAreForbidden() throws Exception {
        for (String suffix : List.of("", "/status", "/activate")) {
            String method = suffix.equals("/status") ? "PATCH" : suffix.isEmpty() ? "PUT" : "POST";
            FilterChain chain = mock(FilterChain.class);
            assertEquals(403, run(method, "/api/v1/users/" + OTHER_SCHOOL_USER + suffix, chain).getStatus(),
                    method + " " + suffix);
            verify(chain, never()).doFilter(any(), any());
        }
    }

    @Test
    void putOnPersonInsideTheSchoolPasses() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = run("PUT", "/api/v1/persons/" + SAME_SCHOOL_PERSON, chain);
        assertEquals(200, response.getStatus());
        verify(chain).doFilter(any(), any());
    }

    @Test
    void personTheAdminCreatedStaysEditableBeforeItHasASchool() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        assertEquals(200, run("PUT", "/api/v1/persons/" + CREATED_BY_ADMIN, chain).getStatus());
        verify(chain).doFilter(any(), any());
    }

    @Test
    void authMeRequiresASession() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter().doFilter(new MockHttpServletRequest("GET", "/api/v1/auth/me"), response, chain);
        assertEquals(401, response.getStatus());
        verify(chain, never()).doFilter(any(), any());
    }
}
