package com.faceattend_edu.scheduling_service.infrastructure.web.controller;

import com.faceattend_edu.scheduling_service.domain.port.in.GetEnvironmentUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.ListClassSessionsUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.ListScheduleBlocksUseCase;
import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.infrastructure.web.mapper.ClassSessionWebMapper;
import com.faceattend_edu.scheduling_service.infrastructure.web.mapper.ScheduleBlockWebMapper;
import com.faceattend_edu.scheduling_service.infrastructure.web.security.AuthTokenFilter;
import com.faceattend_edu.scheduling_service.infrastructure.web.security.CallerSchoolContext;
import com.faceattend_edu.scheduling_service.infrastructure.web.security.CallerSchoolResolver.CallerSchool;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Blocks and sessions have no school of their own: they are scoped through their environment. */
@DisplayName("Schedule relations stay inside the caller's school")
class ScheduleRelationsControllerTest {

    private final ListScheduleBlocksUseCase blocks = mock(ListScheduleBlocksUseCase.class);
    private final ListClassSessionsUseCase sessions = mock(ListClassSessionsUseCase.class);
    private final GetEnvironmentUseCase environments = mock(GetEnvironmentUseCase.class);
    private final ScheduleRelationsController controller = new ScheduleRelationsController(
            blocks, sessions, environments, new ScheduleBlockWebMapper(), new ClassSessionWebMapper());

    private static ScheduleBlock block(long id, long cohort, int environment, long instructor) {
        ScheduleBlock b = new ScheduleBlock();
        b.setScheduleBlockId(id);
        b.setCohortId(cohort);
        b.setCourseId(1);
        b.setEnvironmentId(environment);
        b.setInstructorActorId(instructor);
        b.setDayOfWeek((short) 1);
        b.setStartsAt(LocalTime.of(7, 0));
        b.setEndsAt(LocalTime.of(9, 0));
        return b;
    }

    private static Environment environmentOf(int school) {
        Environment e = new Environment();
        e.setSchoolId(school);
        return e;
    }

    private static void callerIs(CallerSchool caller) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (caller != null) request.setAttribute(AuthTokenFilter.CALLER_SCHOOL_ATTRIBUTE, caller);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @BeforeEach
    void setUp() {
        // Environment 10 is in school 1, environment 20 in school 2.
        when(blocks.list()).thenReturn(List.of(block(1, 100, 10, 7), block(2, 100, 20, 7), block(3, 200, 10, 8)));
        when(environments.getById(10)).thenReturn(environmentOf(1));
        when(environments.getById(20)).thenReturn(environmentOf(2));
        ClassSession session = new ClassSession();
        session.setClassSessionId(50L);
        session.setScheduleBlockId(2L);
        session.setSessionDate(LocalDate.of(2026, 10, 5));
        session.setSessionStatus("Open");
        when(sessions.list()).thenReturn(List.of(session));
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void anAdministradorSeesOnlyBlocksOfItsOwnSchool() {
        callerIs(new CallerSchool(false, 1, 5L));
        assertThat(controller.blocksByCohort(100L).getBody()).extracting("scheduleBlockId").containsExactly(1L);
        assertThat(controller.blocksByActor(7L).getBody()).extracting("scheduleBlockId").containsExactly(1L);
        assertThat(controller.blocksByEnvironment(20).getBody()).isEmpty();
        assertThat(controller.blocksByEnvironment(10).getBody()).extracting("scheduleBlockId").containsExactly(1L, 3L);
    }

    @Test
    void superAdministradorSeesEverythingWithoutEnvironmentLookups() {
        callerIs(new CallerSchool(true, null, null));
        assertThat(controller.blocksByCohort(100L).getBody()).hasSize(2);
        verify(environments, never()).getById(anyInt());
    }

    @Test
    void aCallerWithoutASchoolSeesNothing() {
        callerIs(new CallerSchool(false, null, null));
        assertThat(controller.blocksByCohort(100L).getBody()).isEmpty();
    }

    @Test
    void sessionsOfAForeignBlockLookMissing() {
        callerIs(new CallerSchool(false, 1, 5L));
        assertThatThrownBy(() -> controller.sessionsByBlock(2L)).isInstanceOf(CallerSchoolContext.ScopeForbiddenException.class);

        callerIs(new CallerSchool(false, 2, 6L));
        assertThat(controller.sessionsByBlock(2L).getBody()).extracting("classSessionId").containsExactly(50L);

        callerIs(null);
        assertThat(controller.sessionsByBlock(2L).getBody()).hasSize(1);
    }
}
