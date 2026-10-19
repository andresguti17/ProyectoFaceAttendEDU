package com.faceattend_edu.attendance_service.infrastructure.persistence;

import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.AttendanceRecordJpaEntity;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.ActorAttendanceCount;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.AttendanceGroupCount;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.AttendanceRecordJpaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * AttendanceRecordJpaRepository against H2: the unique constraint
 * {@code uq_attendance_session_actor} (one attendance record per actor and
 * session, so the aggregation counts are always one row per group) and the two
 * aggregation queries the service relies on ({@code summarizeByActors},
 * {@code countByGroups}).
 */
@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true"
})
@DisplayName("IEEE 829 TC-05: Attendance Record Repository Tests")
class AttendanceRecordJpaRepositoryTest {

    @Autowired
    private AttendanceRecordJpaRepository repository;

    private AttendanceRecordJpaEntity entity(long session, long actor, String status, Instant deletedAt) {
        AttendanceRecordJpaEntity e = new AttendanceRecordJpaEntity();
        e.setClassSessionId(session);
        e.setAcademicActorId(actor);
        e.setAttendanceStatus(status);
        e.setCaptureMethod("MANUAL");
        e.setCreatedAt(Instant.now());
        e.setDeletedAt(deletedAt);
        return e;
    }

    private AttendanceRecordJpaEntity record(long session, long actor, String status, Instant deletedAt) {
        return repository.save(entity(session, actor, status, deletedAt));
    }

    private long total(List<AttendanceGroupCount> rows) {
        return rows.stream().mapToLong(AttendanceGroupCount::getTotal).sum();
    }

    @Test
    @DisplayName("TC-05-P01: unique constraint uq_attendance_session_actor rejects second record for same session and actor")
    void secondRecordForSameSessionAndActorViolatesUniqueConstraint() {
        // Arrange
        record(10L, 20L, "Present", null);
        AttendanceRecordJpaEntity duplicate = entity(10L, 20L, "Absent", null);

        // Act & Assert
        assertThrows(DataIntegrityViolationException.class, () -> repository.save(duplicate));
    }

    @Test
    @DisplayName("TC-05-P02: summarizeByActors groups by actor and status, excluding soft-deleted rows")
    void summarizeByActorsGroupsAndExcludesDeleted() {
        // Arrange
        record(100L, 1L, "Present", null);
        record(101L, 1L, "Present", null);
        record(102L, 1L, "Absent", null);
        record(103L, 1L, "Late", Instant.now()); // soft-deleted: excluded
        record(100L, 2L, "Present", null);
        repository.flush();

        // Act
        List<ActorAttendanceCount> rows = repository.summarizeByActors(List.of(1L, 2L));

        // Assert
        assertEquals(3, rows.size());
        assertEquals(2, countFor(rows, 1L, "Present"));
        assertEquals(1, countFor(rows, 1L, "Absent"));
        assertEquals(1, countFor(rows, 2L, "Present"));
        assertNull(statusFor(rows, 1L, "Late"), "soft-deleted rows must not be aggregated");
    }

    @Test
    @DisplayName("TC-05-P03: countByGroups honours the four bySessions/byActors flag combinations")
    void countByGroupsHonoursAllFlagCombinations() {
        // Arrange — one record per (session, actor): the unique constraint forbids repeats
        record(200L, 1L, "Present", null);
        record(200L, 2L, "Absent", null);
        record(200L, 3L, "Late", null);
        record(201L, 1L, "Present", null);
        record(202L, 3L, "Present", null);
        record(204L, 1L, "Absent", null);
        record(203L, 2L, "Present", Instant.now()); // soft-deleted: excluded
        repository.flush();

        // Act & Assert — sessions only
        List<AttendanceGroupCount> bySession =
                repository.countByGroups(true, Set.of(200L), false, Set.of(-1L));
        assertEquals(3, total(bySession));
        assertEquals(3, bySession.size());

        // Act & Assert — actors only
        List<AttendanceGroupCount> byActor =
                repository.countByGroups(false, Set.of(-1L), true, Set.of(1L));
        assertEquals(3, total(byActor)); // sessions 200, 201 and 204; deleted row excluded

        // Act & Assert — both filters
        List<AttendanceGroupCount> both =
                repository.countByGroups(true, Set.of(200L), true, Set.of(1L, 2L));
        assertEquals(2, total(both));
        assertEquals(2, both.size());
        assertEquals("Present", statusForBoth(both, 200L, 1L, "Present"));
        assertEquals("Absent", statusForBoth(both, 200L, 2L, "Absent"));

        // Act & Assert — no filter: placeholder sets, flags off, everything counts
        List<AttendanceGroupCount> all =
                repository.countByGroups(false, Set.of(-1L), false, Set.of(-1L));
        assertEquals(6, total(all));
    }

    private long countFor(List<ActorAttendanceCount> rows, long actorId, String status) {
        return rows.stream()
                .filter(r -> r.getAcademicActorId() == actorId && status.equals(r.getAttendanceStatus()))
                .mapToLong(ActorAttendanceCount::getTotal)
                .sum();
    }

    private String statusFor(List<ActorAttendanceCount> rows, long actorId, String status) {
        return rows.stream()
                .filter(r -> r.getAcademicActorId() == actorId && status.equals(r.getAttendanceStatus()))
                .findFirst()
                .map(ActorAttendanceCount::getAttendanceStatus)
                .orElse(null);
    }

    private String statusForBoth(List<AttendanceGroupCount> rows, long sessionId, long actorId, String status) {
        return rows.stream()
                .filter(r -> r.getClassSessionId() == sessionId
                        && r.getAcademicActorId() == actorId
                        && status.equals(r.getAttendanceStatus()))
                .findFirst()
                .map(AttendanceGroupCount::getAttendanceStatus)
                .orElse(null);
    }
}
