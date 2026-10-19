package com.faceattend_edu.identity_service.adapter.in.web.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AuthTokenFilterTest {

    private static final String ME = "33333333-3333-4333-8333-333333333333";
    private static final String OTHER = "44444444-4444-4444-8444-444444444444";

    @Test
    void itemReadsNeedPersonRead() {
        assertEquals("identity.person:read", AuthTokenFilter.requiredPermission("GET", "/api/v1/persons/" + OTHER, ME));
    }

    @Test
    void accountAndSessionListingsAreAdminOnly() {
        assertEquals("identity.person:write", AuthTokenFilter.requiredPermission("GET", "/api/v1/users", ME));
        assertEquals("identity.person:write", AuthTokenFilter.requiredPermission("GET", "/api/v1/sessions", ME));
        assertEquals("identity.person:write", AuthTokenFilter.requiredPermission("GET", "/api/v1/sessions/user/" + OTHER, ME));
    }

    @Test
    void ownSessionsNeedOnlyRead() {
        assertEquals("identity.person:read", AuthTokenFilter.requiredPermission("GET", "/api/v1/sessions/user/" + ME, ME));
    }

    @Test
    void writesNeedPersonWrite() {
        assertEquals("identity.person:write", AuthTokenFilter.requiredPermission("PUT", "/api/v1/persons/" + ME, ME));
        assertEquals("identity.person:write", AuthTokenFilter.requiredPermission("POST", "/api/v1/users", ME));
    }

    @Test
    void changingOwnPasswordNeedsOnlyASession() {
        assertEquals(null, AuthTokenFilter.requiredPermission("POST", "/api/v1/auth/change-password", ME));
    }

    @Test
    void anotherAccountIsReadableOnlyByAdmins() {
        assertEquals("identity.person:write", AuthTokenFilter.requiredPermission("GET", "/api/v1/users/" + OTHER, ME));
        assertEquals("identity.person:read", AuthTokenFilter.requiredPermission("GET", "/api/v1/users/" + ME, ME));
    }
}
