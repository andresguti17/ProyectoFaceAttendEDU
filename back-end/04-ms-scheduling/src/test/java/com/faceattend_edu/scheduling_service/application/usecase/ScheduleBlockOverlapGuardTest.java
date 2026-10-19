package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.out.ScheduleBlockRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleBlockOverlapGuardTest {

    private static final LocalTime FROM = LocalTime.of(9, 0);
    private static final LocalTime TO = LocalTime.of(11, 0);

    @Mock ScheduleBlockRepository repository;

    private ScheduleBlock block() {
        ScheduleBlock block = new ScheduleBlock();
        block.setEnvironmentId(3);
        block.setInstructorActorId(4L);
        block.setDayOfWeek((short) 2);
        block.setStartsAt(FROM);
        block.setEndsAt(TO);
        return block;
    }

    @Test
    void passesWhenNeitherTheRoomNorTheInstructorIsBusy() {
        assertDoesNotThrow(() -> new ScheduleBlockOverlapGuard(repository).check(block(), null));
    }

    @Test
    void failsWhenTheRoomIsBusy() {
        when(repository.existsEnvironmentOverlap(3, (short) 2, FROM, TO, null)).thenReturn(true);

        DuplicateEntityException error = assertThrows(DuplicateEntityException.class,
                () -> new ScheduleBlockOverlapGuard(repository).check(block(), null));
        org.junit.jupiter.api.Assertions.assertTrue(error.getMessage().contains("Environment 3"));
    }

    @Test
    void failsWhenTheInstructorIsBusy() {
        when(repository.existsInstructorOverlap(4L, (short) 2, FROM, TO, null)).thenReturn(true);

        DuplicateEntityException error = assertThrows(DuplicateEntityException.class,
                () -> new ScheduleBlockOverlapGuard(repository).check(block(), null));
        org.junit.jupiter.api.Assertions.assertTrue(error.getMessage().contains("Instructor 4"));
    }

    @Test
    void editingABlockExcludesItselfFromTheCheck() {
        new ScheduleBlockOverlapGuard(repository).check(block(), 77L);

        verify(repository).existsEnvironmentOverlap(3, (short) 2, FROM, TO, 77L);
        verify(repository).existsInstructorOverlap(4L, (short) 2, FROM, TO, 77L);
    }
}
