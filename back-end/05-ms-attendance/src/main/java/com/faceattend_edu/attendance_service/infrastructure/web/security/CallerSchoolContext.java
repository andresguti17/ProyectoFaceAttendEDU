package com.faceattend_edu.attendance_service.infrastructure.web.security;

import com.faceattend_edu.attendance_service.infrastructure.web.security.CallerSchoolResolver.CallerSchool;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

/**
 * The current request's {@link CallerSchool} (set by {@link AuthTokenFilter}
 * for /api/v1/justification-types). Absent (tests without the filter) means
 * unrestricted — same "no attribute = admin" convention as {@link ActorScope}.
 */
public final class CallerSchoolContext {

    public static final String ATTRIBUTE = "attendance.callerSchool";

    private CallerSchoolContext() {}

    private static CallerSchool current() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        Object value = attributes == null ? null : attributes.getAttribute(ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
        return value instanceof CallerSchool cs ? cs : null;
    }

    public static boolean restricted() {
        CallerSchool cs = current();
        return cs != null && !cs.isSuperAdmin();
    }

    public static Integer ownSchoolId() {
        CallerSchool cs = current();
        return cs == null ? null : cs.schoolId();
    }

    /** A null `typeSchoolId` is the shared global catalog — visible to everyone, editable only by Super Administrador. */
    public static boolean allowsType(Integer typeSchoolId) {
        if (typeSchoolId == null) return true;
        CallerSchool cs = current();
        if (cs == null || cs.isSuperAdmin()) return true;
        return typeSchoolId.equals(cs.schoolId());
    }

    public static void requireType(Integer typeSchoolId) {
        if (!allowsType(typeSchoolId)) throw new ActorScope.ScopeForbiddenException();
    }

    /** Only Super Administrador may touch the global (school_id NULL) catalog. */
    public static void requireOwnOrGlobalWrite(Integer typeSchoolId) {
        CallerSchool cs = current();
        if (cs == null || cs.isSuperAdmin()) return;
        if (typeSchoolId == null || !typeSchoolId.equals(cs.schoolId())) throw new ActorScope.ScopeForbiddenException();
    }
}
