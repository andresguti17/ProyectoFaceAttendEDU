package com.faceattend_edu.scheduling_service.infrastructure.persistence;

import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.adapter.ClassSessionPersistenceAdapter;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.adapter.EnvironmentPersistenceAdapter;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.adapter.ScheduleBlockPersistenceAdapter;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.mapper.ClassSessionPersistenceMapper;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.mapper.EnvironmentPersistenceMapper;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.mapper.ScheduleBlockPersistenceMapper;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.repository.ClassSessionJpaRepository;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.repository.EnvironmentJpaRepository;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.repository.ScheduleBlockJpaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("Scheduling persistence: mappers keep every column, adapters delegate")
class SchedulingPersistenceTest {

    private static final Instant T1 = Instant.parse("2026-10-01T10:00:00Z");
    private static final Instant T2 = Instant.parse("2026-10-02T10:00:00Z");
    private static final UUID BY = UUID.fromString("11111111-1111-4111-8111-111111111111");

    private static Environment environment() {
        Environment e = new Environment();
        e.setEnvironmentId(3);
        e.setSchoolId(1);
        e.setCode("A-101");
        e.setName("Aula 101");
        e.setCapacity((short) 30);
        e.setStatus(true);
        e.setCreatedAt(T1);
        e.setUpdatedAt(T2);
        e.setDeletedAt(null);
        e.setCreatedBy(BY);
        e.setUpdatedBy(BY);
        e.setDeletedBy(null);
        e.setRowVersion(2);
        return e;
    }

    private static ScheduleBlock block() {
        ScheduleBlock b = new ScheduleBlock();
        b.setScheduleBlockId(5L);
        b.setCohortId(1L);
        b.setCourseId(2);
        b.setEnvironmentId(3);
        b.setInstructorActorId(4L);
        b.setDayOfWeek((short) 2);
        b.setStartsAt(LocalTime.of(7, 0));
        b.setEndsAt(LocalTime.of(9, 0));
        b.setCreatedAt(T1);
        b.setUpdatedAt(T2);
        b.setCreatedBy(BY);
        b.setRowVersion(1);
        return b;
    }

    private static ClassSession session() {
        ClassSession s = new ClassSession();
        s.setClassSessionId(8L);
        s.setScheduleBlockId(5L);
        s.setSessionDate(LocalDate.of(2026, 10, 5));
        s.setOpenedBy(4L);
        s.setOpenedAt(T1);
        s.setClosedBy(4L);
        s.setClosedAt(T2);
        s.setSessionStatus("Closed");
        s.setCreatedAt(T1);
        s.setUpdatedAt(T2);
        s.setCreatedBy(BY);
        s.setRowVersion(3);
        return s;
    }

    @Test
    void mappersRoundTripEveryField() {
        EnvironmentPersistenceMapper environments = new EnvironmentPersistenceMapper();
        assertThat(environments.toDomain(environments.toEntity(environment()))).usingRecursiveComparison().isEqualTo(environment());
        ScheduleBlockPersistenceMapper blocks = new ScheduleBlockPersistenceMapper();
        assertThat(blocks.toDomain(blocks.toEntity(block()))).usingRecursiveComparison().isEqualTo(block());
        ClassSessionPersistenceMapper sessions = new ClassSessionPersistenceMapper();
        assertThat(sessions.toDomain(sessions.toEntity(session()))).usingRecursiveComparison().isEqualTo(session());
        assertThat(environments.toDomain(null)).isNull();
        assertThat(blocks.toEntity(null)).isNull();
        assertThat(sessions.toDomain(null)).isNull();
    }

    @Test
    void environmentAdapterDelegatesAndMaps() {
        EnvironmentJpaRepository jpa = mock(EnvironmentJpaRepository.class);
        EnvironmentPersistenceMapper mapper = new EnvironmentPersistenceMapper();
        EnvironmentPersistenceAdapter adapter = new EnvironmentPersistenceAdapter(jpa, mapper);
        when(jpa.save(any())).thenAnswer(inv -> inv.getArgument(0));
        assertThat(adapter.save(environment()).getCode()).isEqualTo("A-101");
        when(jpa.findById(3)).thenReturn(Optional.of(mapper.toEntity(environment())));
        assertThat(adapter.findById(3)).map(Environment::getName).contains("Aula 101");
        when(jpa.findBySchoolIdAndCode(1, "A-101")).thenReturn(Optional.empty());
        assertThat(adapter.findBySchoolIdAndCode(1, "A-101")).isEmpty();
        when(jpa.findAll()).thenReturn(List.of(mapper.toEntity(environment())));
        assertThat(adapter.findAll()).hasSize(1);
        when(jpa.findBySchoolId(1)).thenReturn(List.of(mapper.toEntity(environment()), mapper.toEntity(environment())));
        assertThat(adapter.findBySchoolId(1)).hasSize(2);
        adapter.deleteById(3);
        verify(jpa).deleteById(3);
        when(jpa.existsById(3)).thenReturn(true);
        assertThat(adapter.existsById(3)).isTrue();
    }

    @Test
    void blockAdapterChecksOverlapsWithANeverMatchingIdForNewBlocks() {
        ScheduleBlockJpaRepository jpa = mock(ScheduleBlockJpaRepository.class);
        ScheduleBlockPersistenceMapper mapper = new ScheduleBlockPersistenceMapper();
        ScheduleBlockPersistenceAdapter adapter = new ScheduleBlockPersistenceAdapter(jpa, mapper);
        LocalTime from = LocalTime.of(7, 0);
        LocalTime to = LocalTime.of(9, 0);
        when(jpa.existsEnvironmentOverlap(3, (short) 2, from, to, -1L)).thenReturn(true);
        when(jpa.existsInstructorOverlap(4L, (short) 2, from, to, 5L)).thenReturn(false);
        assertThat(adapter.existsEnvironmentOverlap(3, (short) 2, from, to, null)).isTrue();
        assertThat(adapter.existsInstructorOverlap(4L, (short) 2, from, to, 5L)).isFalse();

        when(jpa.save(any())).thenAnswer(inv -> inv.getArgument(0));
        assertThat(adapter.save(block()).getDayOfWeek()).isEqualTo((short) 2);
        when(jpa.findById(5L)).thenReturn(Optional.of(mapper.toEntity(block())));
        assertThat(adapter.findById(5L)).isPresent();
        when(jpa.findAll()).thenReturn(List.of(mapper.toEntity(block())));
        assertThat(adapter.findAll()).hasSize(1);
        adapter.deleteById(5L);
        verify(jpa).deleteById(5L);
        when(jpa.existsById(5L)).thenReturn(true);
        assertThat(adapter.existsById(5L)).isTrue();
    }

    @Test
    void sessionAdapterDelegatesAndMaps() {
        ClassSessionJpaRepository jpa = mock(ClassSessionJpaRepository.class);
        ClassSessionPersistenceMapper mapper = new ClassSessionPersistenceMapper();
        ClassSessionPersistenceAdapter adapter = new ClassSessionPersistenceAdapter(jpa, mapper);
        when(jpa.save(any())).thenAnswer(inv -> inv.getArgument(0));
        assertThat(adapter.save(session()).getSessionStatus()).isEqualTo("Closed");
        when(jpa.findById(8L)).thenReturn(Optional.of(mapper.toEntity(session())));
        assertThat(adapter.findById(8L)).map(ClassSession::getClosedBy).contains(4L);
        when(jpa.findAll()).thenReturn(List.of());
        assertThat(adapter.findAll()).isEmpty();
        when(jpa.findByScheduleBlockId(5L)).thenReturn(List.of(mapper.toEntity(session())));
        assertThat(adapter.findByScheduleBlockId(5L)).hasSize(1);
        adapter.deleteById(8L);
        verify(jpa).deleteById(8L);
        when(jpa.existsById(8L)).thenReturn(false);
        assertThat(adapter.existsById(8L)).isFalse();
    }
}
