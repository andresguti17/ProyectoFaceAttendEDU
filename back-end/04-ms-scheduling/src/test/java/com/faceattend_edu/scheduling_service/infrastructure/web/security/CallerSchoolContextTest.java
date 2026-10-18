package com.faceattend_edu.scheduling_service.infrastructure.web.security;

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
        if (value != null) request.setAttribute(AuthTokenFilter.CALLER_SCHOOL_ATTRIBUTE, value);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @Test
    void noAttributeMeansUnrestricted_sameConventionAsActorScope() {
        scope(null);
        assertThat(CallerSchoolContext.restricted()).isFalse();
        assertThat(CallerSchoolContext.allowsSchool(999)).isTrue();
        assertThat(CallerSchoolContext.ownSchoolId()).isNull();
    }

    @Test
    void superAdminIsUnrestricted() {
        scope(CallerSchoolResolver.CallerSchool.SUPER_ADMIN);
        assertThat(CallerSchoolContext.restricted()).isFalse();
        assertThat(CallerSchoolContext.allowsSchool(1)).isTrue();
        assertThat(CallerSchoolContext.allowsSchool(999)).isTrue();
    }

    @Test
    void schoolAdminOnlyAllowsOwnSchool() {
        scope(new CallerSchoolResolver.CallerSchool(false, 100, 5L));
        assertThat(CallerSchoolContext.restricted()).isTrue();
        assertThat(CallerSchoolContext.allowsSchool(100)).isTrue();
        assertThat(CallerSchoolContext.allowsSchool(200)).isFalse();
        assertThat(CallerSchoolContext.ownSchoolId()).isEqualTo(100);
        assertThat(CallerSchoolContext.ownActorId()).isEqualTo(5L);
        assertThatThrownBy(() -> CallerSchoolContext.requireSchool(200))
                .isInstanceOf(CallerSchoolContext.ScopeForbiddenException.class);
    }

    @Test
    void callerWithoutOwnSchoolFailsSecureAllowingNothing() {
        scope(new CallerSchoolResolver.CallerSchool(false, null, null));
        assertThat(CallerSchoolContext.restricted()).isTrue();
        assertThat(CallerSchoolContext.allowsSchool(1)).isFalse();
        assertThat(CallerSchoolContext.allowsSchool(null)).isFalse();
    }
}
