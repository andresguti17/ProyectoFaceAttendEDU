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
    @DisplayName("other writes still require identity.person:write")
    void otherWritesStillProtected() {
        assertEquals("identity.person:write", AuthTokenFilter.requiredPermission("PUT", "/api/v1/auth/me", CALLER));
        assertEquals("identity.person:write", AuthTokenFilter.requiredPermission("POST", "/api/v1/auth/me/profile", CALLER));
        assertEquals("identity.person:write",
                AuthTokenFilter.requiredPermission("PUT", "/api/v1/persons/" + CALLER, CALLER));
    }
}
