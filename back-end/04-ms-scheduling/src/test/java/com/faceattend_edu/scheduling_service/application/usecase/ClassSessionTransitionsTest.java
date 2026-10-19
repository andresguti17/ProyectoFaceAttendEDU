package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.exception.ValidationException;
import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.port.out.ClassSessionRepository;
import com.faceattend_edu.scheduling_service.infrastructure.messaging.DomainEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Open -> Closed | Cancelled, with the closing actor recorded. */
@ExtendWith(MockitoExtension.class)
class ClassSessionTransitionsTest {

    private static final long ID = 7L;

    @Mock ClassSessionRepository repository;
    @Mock DomainEventPublisher eventPublisher;

    private OpenClassSessionUseCaseImpl open;
    private CloseClassSessionUseCaseImpl close;
    private CancelClassSessionUseCaseImpl cancel;
    private CreateClassSessionUseCaseImpl create;

    @BeforeEach
    void setUp() {
        open = new OpenClassSessionUseCaseImpl(repository);
        close = new CloseClassSessionUseCaseImpl(repository);
        cancel = new CancelClassSessionUseCaseImpl(repository);
        create = new CreateClassSessionUseCaseImpl(repository, eventPublisher);
        lenient().when(repository.save(any(ClassSession.class))).thenAnswer(call -> call.getArgument(0));
    }

    private ClassSession sessionIn(String status) {
        ClassSession session = new ClassSession();
        session.setClassSessionId(ID);
        session.setScheduleBlockId(1L);
        session.setSessionDate(LocalDate.of(2026, 3, 2));
        session.setSessionStatus(status);
        return session;
    }

    private void existing(String status) {
        when(repository.findById(ID)).thenReturn(Optional.of(sessionIn(status)));
    }

    @Test
    void closingAnOpenSessionRecordsWhoAndWhen() {
        existing("Open");

        ClassSession result = close.close(ID, 55L);

        assertEquals("Closed", result.getSessionStatus());
        assertEquals(55L, result.getClosedBy());
        assertNotNull(result.getClosedAt());
    }

    @Test
    void cancellingAnOpenSessionIsAllowed() {
        existing("Open");

        assertEquals("Cancelled", cancel.cancel(ID).getSessionStatus());
    }

    @Test
    void aClosedSessionCannotBeCancelledOrClosedAgain() {
        existing("Closed");

        assertThrows(ValidationException.class, () -> cancel.cancel(ID));
        assertThrows(ValidationException.class, () -> close.close(ID, 1L));
        verify(repository, never()).save(any());
    }

    @Test
    void aCancelledSessionCannotBeClosedOrOpenedAgain() {
        existing("Cancelled");

        assertThrows(ValidationException.class, () -> close.close(ID, 1L));
        assertThrows(ValidationException.class, () -> open.open(ID, 1L));
        assertThrows(ValidationException.class, () -> cancel.cancel(ID));
        verify(repository, never()).save(any());
    }

    @Test
    void anAlreadyOpenSessionCannotBeOpenedTwice() {
        existing("Open");

        assertThrows(ValidationException.class, () -> open.open(ID, 1L));
    }

    @Test
    void transitionsOnAMissingSessionAreNotFound() {
        when(repository.findById(ID)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> close.close(ID, 1L));
        assertThrows(EntityNotFoundException.class, () -> cancel.cancel(ID));
        assertThrows(EntityNotFoundException.class, () -> open.open(ID, 1L));
    }

    @Test
    void aNewSessionWithoutStatusStartsOpen() {
        ClassSession input = sessionIn(null);
        input.setClassSessionId(null);

        ClassSession saved = create.create(input);

        assertEquals("Open", saved.getSessionStatus());
    }

    @Test
    void aNewOpenSessionIsSavedWithRowVersionOne() {
        ClassSession input = sessionIn("Open");
        input.setClassSessionId(null);

        ClassSession saved = create.create(input);

        assertEquals("Open", saved.getSessionStatus());
        assertEquals(1L, saved.getRowVersion());
    }

    @Test
    void rejectsAStatusOutsideTheEnum() {
        ClassSession input = sessionIn("Paused");

        assertThrows(IllegalArgumentException.class, () -> create.create(input));
        verify(repository, never()).save(any());
    }

    @Test
    void twoSessionsForTheSameBlockAndDateAreADuplicate() {
        ClassSession input = sessionIn("Open");
        when(repository.save(input)).thenThrow(new DataIntegrityViolationException("uq_session_block_date"));

        assertThrows(DuplicateEntityException.class, () -> create.create(input));
    }
}
