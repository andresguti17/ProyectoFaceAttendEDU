package com.faceattend_edu.identity_service.adapter.in.web.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** El perfil propio solo exige sesión; el resto de escrituras sobre identity siguen exigiendo permiso. */
class AuthTokenFilterProfileTest {

    private static final String CALLER = "a0000000-0000-4000-8000-000000000001";

    @Test
    @DisplayName("PUT /auth/me/profile needs only a session")
    void profileNeedsOnlySession() {
        assertNull(AuthTokenFilter.requiredPermission("PUT", "/api/v1/auth/me/profile", CALLER));
    }

    @Test
    @DisplayName("GET /auth/session (who the own session is) needs only a session")
    void currentSessionNeedsOnlySession() {
        assertNull(AuthTokenFilter.requiredPermission("GET", "/api/v1/auth/session", CALLER));
    }

    @Test
    @DisplayName("the own second factor needs only a session, the use cases ask for password or code")
    void twoFactorNeedsOnlySession() {
        for (String action : new String[] {"enable", "confirm", "disable"}) {
            assertNull(AuthTokenFilter.requiredPermission("POST", "/api/v1/auth/two-factor/" + action, CALLER));
        }
        assertEquals("identity.person:write", AuthTokenFilter.requiredPermission("PUT", "/api/v1/auth/two-factor/enable", CALLER));
    }

    @Test
    @DisplayName("other writes still require identity.person:write")
    void otherWritesStillProtected() {
        assertEquals("identity.person:write", AuthTokenFilter.requiredPermission("PUT", "/api/v1/auth/me", CALLER));
        assertEquals("identity.person:write", AuthTokenFilter.requiredPermission("POST", "/api/v1/auth/me/profile", CALLER));
        assertEquals("identity.person:write",
                AuthTokenFilter.requiredPermission("PUT", "/api/v1/persons/" + CALLER, CALLER));
    }
}
