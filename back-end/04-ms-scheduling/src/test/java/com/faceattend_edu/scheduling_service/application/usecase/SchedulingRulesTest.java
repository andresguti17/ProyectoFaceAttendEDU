package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.out.ClassSessionRepository;
import com.faceattend_edu.scheduling_service.domain.port.out.EnvironmentRepository;
import com.faceattend_edu.scheduling_service.domain.port.out.ScheduleBlockRepository;
import com.faceattend_edu.scheduling_service.infrastructure.messaging.DomainEventPublisher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("Scheduling domain rules and use cases")
class SchedulingRulesTest {

    private static Environment environment() {
        Environment e = new Environment();
        e.setSchoolId(1);
        e.setCode("A-101");
        e.setName("Aula 101");
        e.setCapacity((short) 30);
        e.setStatus(true);
        return e;
    }

    private static ScheduleBlock block() {
        ScheduleBlock b = new ScheduleBlock();
        b.setCohortId(1L);
        b.setCourseId(2);
        b.setEnvironmentId(3);
        b.setInstructorActorId(4L);
        b.setDayOfWeek((short) 1);
        b.setStartsAt(LocalTime.of(7, 0));
        b.setEndsAt(LocalTime.of(9, 0));
        return b;
    }

    private static ClassSession session() {
        ClassSession s = new ClassSession();
        s.setScheduleBlockId(5L);
        s.setSessionDate(LocalDate.of(2026, 10, 5));
        s.setSessionStatus("Open");
        return s;
    }

    @Nested
    class EnvironmentValidation {
        @ParameterizedTest(name = "{0} -> {1}")
        @CsvSource({
                "schoolId, schoolId is required",
                "code, code is required",
                "longCode, code max 50",
                "name, name is required",
                "longName, name max 255",
                "capacity, capacity is required",
                "zeroCapacity, capacity must be > 0",
                "status, status is required",
        })
        void rejectsAnIncompleteEnvironment(String broken, String message) {
            Environment e = environment();
            switch (broken) {
                case "schoolId" -> e.setSchoolId(null);
                case "code" -> e.setCode(" ");
                case "longCode" -> e.setCode("x".repeat(51));
                case "name" -> e.setName(null);
                case "longName" -> e.setName("x".repeat(256));
                case "capacity" -> e.setCapacity(null);
                case "zeroCapacity" -> e.setCapacity((short) 0);
                default -> e.setStatus(null);
            }
            assertThatThrownBy(e::validate).isInstanceOf(IllegalArgumentException.class).hasMessage(message);
        }

        @Test
        void touchCreatedFillsDefaultsAndIdentityIsTheId() {
            Environment e = environment();
            e.setStatus(null);
            e.touchCreated();
            assertThat(e.getStatus()).isTrue();
            assertThat(e.getCreatedAt()).isNotNull();
            assertThat(e.getRowVersion()).isEqualTo(1L);
            e.touchUpdated();
            assertThat(e.getUpdatedAt()).isNotNull();

            Environment a = environment();
            a.setEnvironmentId(7);
            Environment b = environment();
            b.setEnvironmentId(7);
            b.setName("Otro nombre");
            assertThat(a).isEqualTo(b).hasSameHashCodeAs(b).isNotEqualTo(environment()).isNotEqualTo("A-101");
        }
    }

    @Nested
    class BlockAndSessionValidation {
        @Test
        void aBlockNeedsEveryReferenceAValidDayAndStartBeforeEnd() {
            ScheduleBlock b = block();
            b.setDayOfWeek((short) 8);
            assertThatThrownBy(b::validate).hasMessage("dayOfWeek must be between 1 and 7");
            b.setDayOfWeek((short) 1);
            b.setEndsAt(LocalTime.of(7, 0));
            assertThatThrownBy(b::validate).hasMessage("startsAt must be before endsAt");
            b.setCohortId(null);
            assertThatThrownBy(b::validate).hasMessage("cohortId is required");
        }

        @Test
        void aSessionNeedsAKnownStatus() {
            ClassSession s = session();
            s.setSessionStatus("Paused");
            assertThatThrownBy(s::validate).hasMessageStartingWith("sessionStatus must be one of");
            s.setSessionStatus(" ");
            assertThatThrownBy(s::validate).hasMessage("sessionStatus is required");
            s.setSessionDate(null);
            assertThatThrownBy(s::validate).hasMessage("sessionDate is required");
        }
    }

    @Nested
    class EnvironmentUseCases {
        private final EnvironmentRepository repository = mock(EnvironmentRepository.class);
        private final DomainEventPublisher publisher = mock(DomainEventPublisher.class);

        @Test
        void createRejectsADuplicateCodeInTheSameSchool() {
            when(repository.findBySchoolIdAndCode(1, "A-101")).thenReturn(Optional.of(environment()));
            assertThatThrownBy(() -> new CreateEnvironmentUseCaseImpl(repository, publisher).create(environment()))
                    .isInstanceOf(DuplicateEntityException.class);
            verify(repository, never()).save(any());
        }

        @Test
        void createSavesAndPublishesTheEvent() {
            when(repository.findBySchoolIdAndCode(1, "A-101")).thenReturn(Optional.empty());
            when(repository.save(any())).thenAnswer(inv -> {
                Environment saved = inv.getArgument(0);
                saved.setEnvironmentId(9);
                return saved;
            });
            Environment created = new CreateEnvironmentUseCaseImpl(repository, publisher).create(environment());
            assertThat(created.getEnvironmentId()).isEqualTo(9);
            verify(publisher).publish(eq("environment-events"), contains("\"environmentId\":9"));
        }

        @Test
        void createTurnsAUniqueViolationIntoADuplicate() {
            when(repository.findBySchoolIdAndCode(1, "A-101")).thenReturn(Optional.empty());
            when(repository.save(any())).thenThrow(new DataIntegrityViolationException("uq"));
            assertThatThrownBy(() -> new CreateEnvironmentUseCaseImpl(repository, publisher).create(environment()))
                    .isInstanceOf(DuplicateEntityException.class);
        }

        @Test
        void updateChangesOnlyTheGivenFields() {
            Environment stored = environment();
            stored.setEnvironmentId(3);
            when(repository.findById(3)).thenReturn(Optional.of(stored));
            when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            Environment patch = new Environment();
            patch.setName("Laboratorio");
            patch.setCapacity((short) 20);
            Environment updated = new UpdateEnvironmentUseCaseImpl(repository).update(3, patch);
            assertThat(updated.getName()).isEqualTo("Laboratorio");
            assertThat(updated.getCapacity()).isEqualTo((short) 20);
            assertThat(updated.getCode()).isEqualTo("A-101");
            assertThat(updated.getUpdatedAt()).isNotNull();

            Environment all = environment();
            all.setStatus(false);
            assertThat(new UpdateEnvironmentUseCaseImpl(repository).update(3, all).getStatus()).isFalse();
            when(repository.findById(4)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> new UpdateEnvironmentUseCaseImpl(repository).update(4, patch)).isInstanceOf(EntityNotFoundException.class);
        }

        @Test
        void deleteRefusesAnEnvironmentThatStillHasLiveBlocks() {
            ScheduleBlockRepository blocks = mock(ScheduleBlockRepository.class);
            when(repository.existsById(3)).thenReturn(true);
            when(blocks.existsByEnvironmentId(3)).thenReturn(true);
            assertThatThrownBy(() -> new DeleteEnvironmentUseCaseImpl(repository, blocks).delete(3))
                    .isInstanceOf(DuplicateEntityException.class)
                    .hasMessageContaining("schedule blocks");
            verify(repository, never()).deleteById(3);
        }

        @Test
        void deleteGetAndListAnswerForExistingEnvironmentsOnly() {
            when(repository.existsById(3)).thenReturn(true);
            new DeleteEnvironmentUseCaseImpl(repository, mock(ScheduleBlockRepository.class)).delete(3);
            verify(repository).deleteById(3);
            assertThatThrownBy(() -> new DeleteEnvironmentUseCaseImpl(repository, mock(ScheduleBlockRepository.class)).delete(4)).isInstanceOf(EntityNotFoundException.class);

            when(repository.findById(3)).thenReturn(Optional.of(environment()));
            assertThat(new GetEnvironmentUseCaseImpl(repository).getById(3).getCode()).isEqualTo("A-101");
            assertThatThrownBy(() -> new GetEnvironmentUseCaseImpl(repository).getById(5)).isInstanceOf(EntityNotFoundException.class);

            when(repository.findAll()).thenReturn(List.of(environment()));
            when(repository.findBySchoolId(1)).thenReturn(List.of(environment(), environment()));
            assertThat(new ListEnvironmentsUseCaseImpl(repository).list()).hasSize(1);
            assertThat(new ListEnvironmentsUseCaseImpl(repository).listBySchoolId(1)).hasSize(2);
        }
    }

    @Nested
    class BlockAndSessionUseCases {
        private final ScheduleBlockRepository blocks = mock(ScheduleBlockRepository.class);
        private final ScheduleBlockOverlapGuard guard = mock(ScheduleBlockOverlapGuard.class);
        private final ClassSessionRepository sessions = mock(ClassSessionRepository.class);

        @Test
        void updatingABlockMergesTheChangesAndChecksForDoubleBooking() {
            ScheduleBlock stored = block();
            when(blocks.findById(1L)).thenReturn(Optional.of(stored));
            when(blocks.save(any())).thenAnswer(inv -> inv.getArgument(0));
            ScheduleBlock patch = new ScheduleBlock();
            patch.setStartsAt(LocalTime.of(8, 0));
            patch.setEndsAt(LocalTime.of(10, 0));
            patch.setDayOfWeek((short) 2);
            patch.setCohortId(6L);
            patch.setCourseId(7);
            patch.setEnvironmentId(8);
            patch.setInstructorActorId(9L);
            ScheduleBlock updated = new UpdateScheduleBlockUseCaseImpl(blocks, guard).update(1L, patch);
            assertThat(updated.getStartsAt()).isEqualTo(LocalTime.of(8, 0));
            assertThat(updated.getInstructorActorId()).isEqualTo(9L);
            verify(guard).check(stored, 1L);
        }

        @Test
        void aBlockUniqueViolationIsADoubleBookingAndAMissingBlockIs404() {
            when(blocks.findById(1L)).thenReturn(Optional.of(block()));
            when(blocks.save(any())).thenThrow(new DataIntegrityViolationException("uq"));
            assertThatThrownBy(() -> new UpdateScheduleBlockUseCaseImpl(blocks, guard).update(1L, new ScheduleBlock()))
                    .isInstanceOf(DuplicateEntityException.class).hasMessageContaining("double-booking");
            when(blocks.findById(2L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> new UpdateScheduleBlockUseCaseImpl(blocks, guard).update(2L, new ScheduleBlock()))
                    .isInstanceOf(EntityNotFoundException.class);
        }

        @Test
        void sessionsAndBlocksAreUpdatedAndDeletedOnlyWhenTheyExist() {
            when(sessions.findById(1L)).thenReturn(Optional.of(session()));
            when(sessions.save(any())).thenAnswer(inv -> inv.getArgument(0));
            ClassSession patch = new ClassSession();
            patch.setSessionStatus("Closed");
            patch.setSessionDate(LocalDate.of(2026, 10, 6));
            patch.setScheduleBlockId(9L);
            ClassSession updated = new UpdateClassSessionUseCaseImpl(sessions).update(1L, patch);
            assertThat(updated.getSessionStatus()).isEqualTo("Closed");
            assertThat(updated.getScheduleBlockId()).isEqualTo(9L);
            assertThatThrownBy(() -> new UpdateClassSessionUseCaseImpl(sessions).update(2L, patch)).isInstanceOf(EntityNotFoundException.class);
            assertThat(new GetClassSessionUseCaseImpl(sessions).getById(1L).getSessionStatus()).isEqualTo("Closed");

            when(sessions.existsById(1L)).thenReturn(true);
            new DeleteClassSessionUseCaseImpl(sessions).delete(1L);
            verify(sessions).deleteById(1L);
            assertThatThrownBy(() -> new DeleteClassSessionUseCaseImpl(sessions).delete(2L)).isInstanceOf(EntityNotFoundException.class);

            when(blocks.existsById(1L)).thenReturn(true);
            new DeleteScheduleBlockUseCaseImpl(blocks).delete(1L);
            verify(blocks).deleteById(1L);
            assertThatThrownBy(() -> new DeleteScheduleBlockUseCaseImpl(blocks).delete(2L)).isInstanceOf(EntityNotFoundException.class);
        }
    }
}
