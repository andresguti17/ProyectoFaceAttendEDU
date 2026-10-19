package com.faceattend_edu.scheduling_service.domain.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ScheduleBlockTest {

    private ScheduleBlock validBlock() {
        ScheduleBlock block = new ScheduleBlock();
        block.setCohortId(1L);
        block.setCourseId(2);
        block.setEnvironmentId(3);
        block.setInstructorActorId(4L);
        block.setDayOfWeek((short) 1);
        block.setStartsAt(LocalTime.of(8, 0));
        block.setEndsAt(LocalTime.of(10, 0));
        return block;
    }

    @Test
    void acceptsAWellFormedBlock() {
        assertDoesNotThrow(validBlock()::validate);
    }

    @ParameterizedTest
    @ValueSource(shorts = {1, 4, 7})
    void acceptsIsoDaysOfWeek(short day) {
        ScheduleBlock block = validBlock();
        block.setDayOfWeek(day);
        assertDoesNotThrow(block::validate);
    }

    @ParameterizedTest
    @ValueSource(shorts = {0, 8, -1})
    void rejectsDaysOutsideOneToSeven(short day) {
        ScheduleBlock block = validBlock();
        block.setDayOfWeek(day);
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, block::validate);
        assertEquals("dayOfWeek must be between 1 and 7", error.getMessage());
    }

    @Test
    void rejectsAnEmptyTimeRange() {
        ScheduleBlock block = validBlock();
        block.setEndsAt(block.getStartsAt());
        assertThrows(IllegalArgumentException.class, block::validate);
    }

    @Test
    void rejectsAnInvertedTimeRange() {
        ScheduleBlock block = validBlock();
        block.setStartsAt(LocalTime.of(11, 0));
        block.setEndsAt(LocalTime.of(9, 0));
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, block::validate);
        assertEquals("startsAt must be before endsAt", error.getMessage());
    }

    @Test
    void requiresCohortCourseEnvironmentAndInstructor() {
        ScheduleBlock noCohort = validBlock();
        noCohort.setCohortId(null);
        ScheduleBlock noCourse = validBlock();
        noCourse.setCourseId(null);
        ScheduleBlock noEnvironment = validBlock();
        noEnvironment.setEnvironmentId(null);
        ScheduleBlock noInstructor = validBlock();
        noInstructor.setInstructorActorId(null);

        assertThrows(IllegalArgumentException.class, noCohort::validate);
        assertThrows(IllegalArgumentException.class, noCourse::validate);
        assertThrows(IllegalArgumentException.class, noEnvironment::validate);
        assertThrows(IllegalArgumentException.class, noInstructor::validate);
    }

    @Test
    void touchCreatedStartsTheRowVersionAtOne() {
        ScheduleBlock block = validBlock();
        block.touchCreated();
        assertEquals(1L, block.getRowVersion());
    }
}
