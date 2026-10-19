package com.faceattend_edu.scheduling_service.infrastructure.web.security;

import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.infrastructure.web.security.CallerSchoolResolver.CallerSchool;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

/**
 * The current request's {@link CallerSchool} (set by {@link AuthTokenFilter}).
 * Absent (tests without the filter, or the resolver unavailable) means
 * unrestricted — same "no attribute = admin" convention as 05-attendance's
 * ActorScope, so unit tests that bypass the filter keep working.
 */
public final class CallerSchoolContext {

    private CallerSchoolContext() {}

    private static CallerSchool current() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        Object value = attributes == null
                ? null
                : attributes.getAttribute(AuthTokenFilter.CALLER_SCHOOL_ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
        return value instanceof CallerSchool cs ? cs : null;
    }

    /** Whether the current caller is confined to a single school (i.e. not Super Administrador). */
    public static boolean restricted() {
        CallerSchool cs = current();
        return cs != null && !cs.isSuperAdmin();
    }

    /** The caller's own school, or null for Super Administrador / no attribute (unrestricted). */
    public static Integer ownSchoolId() {
        CallerSchool cs = current();
        return cs == null ? null : cs.schoolId();
    }

    public static boolean allowsSchool(Integer schoolId) {
        CallerSchool cs = current();
        return cs == null || cs.isSuperAdmin() || (schoolId != null && schoolId.equals(cs.schoolId()));
    }

    public static void requireSchool(Integer schoolId) {
        if (!allowsSchool(schoolId)) throw new ScopeForbiddenException();
    }

    /** The caller's own academic_actor in their school — for stamping opened_by/closed_by. */
    public static Long ownActorId() {
        CallerSchool cs = current();
        return cs == null ? null : cs.ownActorId();
    }

    /**
     * 404 instead of 403: an entity outside the caller's school must look
     * exactly like a missing one, never confirm it exists elsewhere.
     */
    public static class ScopeForbiddenException extends EntityNotFoundException {
        public ScopeForbiddenException() {
            super("Entity", "outside caller's school");
        }
    }
}
