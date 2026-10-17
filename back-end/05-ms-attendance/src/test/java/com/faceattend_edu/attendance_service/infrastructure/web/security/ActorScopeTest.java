package com.faceattend_edu.attendance_service.infrastructure.web.security;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.port.in.*;
import com.faceattend_edu.attendance_service.infrastructure.web.controller.JustificationController;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.CreateJustificationRequest;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.JustificationWebMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ActorScopeTest {

    @AfterEach
    void clear() {
        RequestContextHolder.resetRequestAttributes();
    }

    private static void scope(Set<Long> actors) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (actors != null) request.setAttribute(ActorScope.ATTRIBUTE, actors);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @Test
    void noScopeMeansUnrestricted() {
        scope(null);
        assertThat(ActorScope.restricted()).isFalse();
        assertThat(ActorScope.allows(99L)).isTrue();
    }

    @Test
    void scopeOnlyAllowsItsActors() {
        scope(Set.of(2L));
        assertThat(ActorScope.allows(2L)).isTrue();
        assertThat(ActorScope.allows(3L)).isFalse();
        assertThatThrownBy(() -> ActorScope.require(3L)).isInstanceOf(ActorScope.ScopeForbiddenException.class);
    }

    @Test
    void apprenticeCannotJustifySomeoneElsesAbsence() {
        scope(Set.of(2L));
        GetAttendanceRecordUseCase records = mock(GetAttendanceRecordUseCase.class);
        AttendanceRecord foreign = new AttendanceRecord();
        foreign.setAcademicActorId(9L);
        when(records.getById(5L)).thenReturn(foreign);
        CreateJustificationUseCase create = mock(CreateJustificationUseCase.class);
        JustificationController controller = new JustificationController(create, mock(ReviewJustificationUseCase.class),
                mock(GetJustificationUseCase.class), mock(ListJustificationsUseCase.class),
                mock(DeleteJustificationUseCase.class), new JustificationWebMapper(), records);
        CreateJustificationRequest request = new CreateJustificationRequest();
        request.setAttendanceRecordId(5L);
        request.setJustificationTypeId(1);
        request.setReason("cita médica");

        assertThatThrownBy(() -> controller.create(request)).isInstanceOf(ActorScope.ScopeForbiddenException.class);
        verifyNoInteractions(create);
    }

    @Test
    void instructorScopeIsOwnActorsPlusActiveStudentsOfTaughtCohorts() {
        Map<String, Object> backend = Map.of(
                "/api/v1/users/u-1", Map.of("personId", "p-1"),
                "/api/v1/academic-actors?limit=100&offset=0", List.of(
                        Map.of("academicActorId", 1, "personId", "p-1"),
                        Map.of("academicActorId", 2, "personId", "p-2")),
                "/api/v1/schedule-blocks?instructorActorId=1", List.of(Map.of("cohortId", 7)),
                "/api/v1/cohorts/7/enrollments", List.of(
                        Map.of("academicActorId", 2, "enrollmentStatus", "Active"),
                        Map.of("academicActorId", 3, "enrollmentStatus", "Withdrawn")));
        CallerScopeResolver resolver = new CallerScopeResolver() {
            private Object at(String url) {
                return backend.get(url.substring(url.indexOf("/api/")));
            }

            @Override
            protected Map<?, ?> getMap(String url, String token) {
                return (Map<?, ?>) at(url);
            }

            @Override
            @SuppressWarnings("unchecked")
            protected List<Map<?, ?>> getList(String url, String token) {
                Object value = at(url);
                return value == null ? List.of() : (List<Map<?, ?>>) value;
            }
        };

        assertThat(resolver.resolve("u-1", List.of("Instructor"), "t")).containsExactlyInAnyOrder(1L, 2L);
        assertThat(resolver.resolve("admin", List.of("Super Administrador"), "t")).isNull();
    }

    @Test
    void schoolAdminScopeIsLimitedToOwnSchool() {
        Map<String, Object> backend = Map.of(
                "/api/v1/users/u-admin", Map.of("personId", "p-admin"),
                "/api/v1/academic-actors?limit=100&offset=0", List.of(
                        Map.of("academicActorId", 1, "personId", "p-admin", "schoolId", 100),
                        Map.of("academicActorId", 2, "personId", "p-2", "schoolId", 100),
                        Map.of("academicActorId", 3, "personId", "p-3", "schoolId", 200)));
        CallerScopeResolver resolver = new CallerScopeResolver() {
            private Object at(String url) {
                return backend.get(url.substring(url.indexOf("/api/")));
            }

            @Override
            protected Map<?, ?> getMap(String url, String token) {
                return (Map<?, ?>) at(url);
            }

            @Override
            @SuppressWarnings("unchecked")
            protected List<Map<?, ?>> getList(String url, String token) {
                Object value = at(url);
                return value == null ? List.of() : (List<Map<?, ?>>) value;
            }
        };

        Set<Long> scope = resolver.resolve("u-admin", List.of("Administrador"), "t");
        assertThat(scope).containsExactlyInAnyOrder(1L, 2L);
    }
}
