package com.faceattend_edu.scheduling_service.infrastructure.web.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AuthTokenFilterTest {

    @Test
    void readsRequireRecordRead() {
        assertEquals("attendance.record:read", AuthTokenFilter.requiredPermission("GET", "/api/v1/environments"));
    }

    @Test
    void environmentAndBlockWritesAreAdminOnly() {
        assertEquals("academic.school:manage", AuthTokenFilter.requiredPermission("POST", "/api/v1/environments"));
        assertEquals("academic.school:manage", AuthTokenFilter.requiredPermission("DELETE", "/api/v1/environments/3"));
        assertEquals("academic.school:manage", AuthTokenFilter.requiredPermission("PUT", "/api/v1/schedule-blocks/3"));
    }

    @Test
    void sessionWritesRequireSessionManage() {
        assertEquals("scheduling.session:manage", AuthTokenFilter.requiredPermission("POST", "/api/v1/class-sessions"));
        assertEquals("scheduling.session:manage", AuthTokenFilter.requiredPermission("POST", "/api/v1/class-sessions/9/open"));
    }
}
