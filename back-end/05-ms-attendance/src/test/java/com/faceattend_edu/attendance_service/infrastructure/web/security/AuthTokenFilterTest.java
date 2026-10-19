package com.faceattend_edu.attendance_service.infrastructure.web.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AuthTokenFilterTest {

    @Test
    void readsRequireRecordRead() {
        assertEquals("attendance.record:read", AuthTokenFilter.requiredPermission("GET", "/api/v1/justifications"));
    }

    @Test
    void filingJustificationsAndDocumentsRequiresRequestPermission() {
        assertEquals("attendance.justification:request", AuthTokenFilter.requiredPermission("POST", "/api/v1/justifications"));
        assertEquals("attendance.justification:request", AuthTokenFilter.requiredPermission("POST", "/api/v1/supporting-documents"));
    }

    @Test
    void reviewRequiresApprove() {
        assertEquals("attendance.justification:approve", AuthTokenFilter.requiredPermission("PATCH", "/api/v1/justifications/7/review"));
    }

    @Test
    void otherWritesRequireRecordWrite() {
        assertEquals("attendance.record:write", AuthTokenFilter.requiredPermission("POST", "/api/v1/attendance-records"));
        assertEquals("attendance.record:write", AuthTokenFilter.requiredPermission("DELETE", "/api/v1/justifications/7"));
    }

    @Test
    void justificationTypeWritesAreAdminOnly() {
        assertEquals("configuration:manage", AuthTokenFilter.requiredPermission("POST", "/api/v1/justification-types"));
        assertEquals("configuration:manage", AuthTokenFilter.requiredPermission("DELETE", "/api/v1/justification-types/4"));
        assertEquals("attendance.record:read", AuthTokenFilter.requiredPermission("GET", "/api/v1/justification-types"));
    }
}
