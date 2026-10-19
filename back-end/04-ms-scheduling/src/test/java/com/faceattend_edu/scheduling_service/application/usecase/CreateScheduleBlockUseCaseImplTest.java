package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.out.ScheduleBlockRepository;
import com.faceattend_edu.scheduling_service.infrastructure.messaging.DomainEventPublisher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CreateScheduleBlockUseCaseImplTest {

    @Mock ScheduleBlockRepository repository;
    @Mock DomainEventPublisher eventPublisher;
    CreateScheduleBlockUseCaseImpl useCase;

    @BeforeEach
    void setUp() {
        useCase = new CreateScheduleBlockUseCaseImpl(repository, new ScheduleBlockOverlapGuard(repository), eventPublisher);
    }

    private ScheduleBlock block(short day, LocalTime start, LocalTime end) {
        ScheduleBlock block = new ScheduleBlock();
        block.setCohortId(1L);
        block.setCourseId(2);
        block.setEnvironmentId(3);
        block.setInstructorActorId(4L);
        block.setDayOfWeek(day);
        block.setStartsAt(start);
        block.setEndsAt(end);
        return block;
    }

    @Test
    void savesAValidBlockAndPublishesTheEvent() {
        ScheduleBlock input = block((short) 2, LocalTime.of(8, 0), LocalTime.of(10, 0));
        ScheduleBlock saved = block((short) 2, LocalTime.of(8, 0), LocalTime.of(10, 0));
        saved.setScheduleBlockId(99L);
        when(repository.save(input)).thenReturn(saved);

        ScheduleBlock result = useCase.create(input);

        assertSame(saved, result);
        assertEquals(1L, input.getRowVersion());
        verify(eventPublisher).publish(eq("schedule-block-events"), any(String.class));
    }

    @Test
    void mapsADoubleBookingConstraintViolationToADuplicate() {
        ScheduleBlock input = block((short) 2, LocalTime.of(8, 0), LocalTime.of(10, 0));
        when(repository.save(input)).thenThrow(new DataIntegrityViolationException("uq_block_environment_slot"));

        assertThrows(DuplicateEntityException.class, () -> useCase.create(input));
        verify(eventPublisher, never()).publish(any(), any());
    }

    @Test
    void neverReachesTheRepositoryWithAnInvertedTimeRange() {
        ScheduleBlock input = block((short) 2, LocalTime.of(10, 0), LocalTime.of(8, 0));

        assertThrows(IllegalArgumentException.class, () -> useCase.create(input));
        verify(repository, never()).save(any());
    }

    @Test
    void rejectsABlockThatOverlapsTheRoomEvenWithADifferentStart() {
        ScheduleBlock input = block((short) 2, LocalTime.of(9, 0), LocalTime.of(11, 0));
        when(repository.existsEnvironmentOverlap(3, (short) 2, LocalTime.of(9, 0), LocalTime.of(11, 0), null)).thenReturn(true);

        assertThrows(DuplicateEntityException.class, () -> useCase.create(input));
        verify(repository, never()).save(any());
    }

    @Test
    void rejectsABlockThatOverlapsTheInstructor() {
        ScheduleBlock input = block((short) 2, LocalTime.of(9, 0), LocalTime.of(11, 0));
        when(repository.existsInstructorOverlap(4L, (short) 2, LocalTime.of(9, 0), LocalTime.of(11, 0), null)).thenReturn(true);

        assertThrows(DuplicateEntityException.class, () -> useCase.create(input));
        verify(repository, never()).save(any());
    }

    @Test
    void neverReachesTheRepositoryWithAnInvalidDay() {
        ScheduleBlock input = block((short) 8, LocalTime.of(8, 0), LocalTime.of(10, 0));

        assertThrows(IllegalArgumentException.class, () -> useCase.create(input));
        verify(repository, never()).save(any());
    }
}
