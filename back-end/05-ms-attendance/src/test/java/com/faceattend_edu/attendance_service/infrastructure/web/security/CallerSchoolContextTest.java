package com.faceattend_edu.attendance_service.infrastructure.web.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CallerSchoolContextTest {

    @AfterEach
    void clear() {
        RequestContextHolder.resetRequestAttributes();
    }

    private static void scope(CallerSchoolResolver.CallerSchool value) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (value != null) request.setAttribute(CallerSchoolContext.ATTRIBUTE, value);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @Test
    void noAttributeMeansUnrestricted() {
        scope(null);
        assertThat(CallerSchoolContext.restricted()).isFalse();
        assertThat(CallerSchoolContext.allowsType(999)).isTrue();
        assertThat(CallerSchoolContext.allowsType(null)).isTrue();
    }

    @Test
    void superAdminSeesAndWritesEverythingIncludingGlobal() {
        scope(CallerSchoolResolver.CallerSchool.SUPER_ADMIN);
        assertThat(CallerSchoolContext.restricted()).isFalse();
        assertThat(CallerSchoolContext.allowsType(null)).isTrue();
        assertThat(CallerSchoolContext.allowsType(200)).isTrue();
        CallerSchoolContext.requireOwnOrGlobalWrite(null); // no throw
    }

    @Test
    void schoolAdminSeesGlobalAndOwnSchoolOnly() {
        scope(new CallerSchoolResolver.CallerSchool(false, 100));
        assertThat(CallerSchoolContext.restricted()).isTrue();
        assertThat(CallerSchoolContext.allowsType(null)).isTrue(); // global, shared
        assertThat(CallerSchoolContext.allowsType(100)).isTrue(); // own school
        assertThat(CallerSchoolContext.allowsType(200)).isFalse(); // another school
    }

    @Test
    void schoolAdminCannotWriteGlobalOrAnotherSchoolsType() {
        scope(new CallerSchoolResolver.CallerSchool(false, 100));
        CallerSchoolContext.requireOwnOrGlobalWrite(100); // own school: no throw
        assertThatThrownBy(() -> CallerSchoolContext.requireOwnOrGlobalWrite(null))
                .isInstanceOf(ActorScope.ScopeForbiddenException.class);
        assertThatThrownBy(() -> CallerSchoolContext.requireOwnOrGlobalWrite(200))
                .isInstanceOf(ActorScope.ScopeForbiddenException.class);
    }

    @Test
    void callerWithoutOwnSchoolFailsSecureAllowingOnlyGlobal() {
        scope(new CallerSchoolResolver.CallerSchool(false, null));
        assertThat(CallerSchoolContext.restricted()).isTrue();
        assertThat(CallerSchoolContext.allowsType(null)).isTrue();
        assertThat(CallerSchoolContext.allowsType(1)).isFalse();
    }
}
