package com.faceattend_edu.authorization_service.infrastructure.web.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthTokenFilterTest {

    @Test
    void assigningAUserRoleIsCheckedPerRoleInTheController() {
        assertFalse(AuthTokenFilter.requiresSuperAdminRole("POST", "/api/v1/users/u-1/roles"));
        assertFalse(AuthTokenFilter.requiresSuperAdminRole("DELETE", "/api/v1/users/u-1/roles/3"));
    }

    @Test
    void readingAUsersRolesNeverRequiresSuperAdmin() {
        assertFalse(AuthTokenFilter.requiresSuperAdminRole("GET", "/api/v1/users/u-1/roles"));
    }

    @Test
    void roleCatalogWritesRequireSuperAdmin() {
        assertTrue(AuthTokenFilter.requiresSuperAdminRole("POST", "/api/v1/roles"));
        assertTrue(AuthTokenFilter.requiresSuperAdminRole("PUT", "/api/v1/roles/1"));
        assertTrue(AuthTokenFilter.requiresSuperAdminRole("DELETE", "/api/v1/roles/1"));
        assertTrue(AuthTokenFilter.requiresSuperAdminRole("POST", "/api/v1/roles/1/permissions"));
        assertTrue(AuthTokenFilter.requiresSuperAdminRole("DELETE", "/api/v1/roles/1/permissions/2"));
        assertFalse(AuthTokenFilter.requiresSuperAdminRole("GET", "/api/v1/roles"));
    }

    @Test
    void permissionCatalogWritesRequireSuperAdmin() {
        assertTrue(AuthTokenFilter.requiresSuperAdminRole("POST", "/api/v1/permissions"));
        assertTrue(AuthTokenFilter.requiresSuperAdminRole("PUT", "/api/v1/permissions/1"));
        assertTrue(AuthTokenFilter.requiresSuperAdminRole("DELETE", "/api/v1/permissions/1"));
        assertFalse(AuthTokenFilter.requiresSuperAdminRole("GET", "/api/v1/permissions"));
    }

    @Test
    void unrelatedWritesDoNotRequireSuperAdmin() {
        assertFalse(AuthTokenFilter.requiresSuperAdminRole("GET", "/api/v1/auth/evaluate"));
        assertFalse(AuthTokenFilter.requiresSuperAdminRole("GET", "/api/v1/user-roles"));
    }
}
