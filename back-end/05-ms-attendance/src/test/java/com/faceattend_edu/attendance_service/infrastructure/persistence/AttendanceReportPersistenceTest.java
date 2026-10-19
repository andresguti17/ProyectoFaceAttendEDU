package com.faceattend_edu.attendance_service.infrastructure.persistence;

import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.AttendanceRecordJpaEntity;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.AttendanceGroupCount;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.AttendanceRecordJpaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * The report query against a real PostgreSQL (schema created by Hibernate).
 * Skipped unless POSTGRES_TEST_URL is set, so a plain {@code mvn test} stays offline.
 */
@EnabledIfEnvironmentVariable(named = "POSTGRES_TEST_URL", matches = ".+")
@SpringBootTest
class AttendanceReportPersistenceTest {

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("POSTGRES_TEST_URL"));
        registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("POSTGRES_USER", "postgres"));
        registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("POSTGRES_PASSWORD", "postgres"));
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create");
    }

    @Autowired AttendanceRecordJpaRepository repository;

    private void save(long session, long actor, String status) {
        AttendanceRecordJpaEntity entity = new AttendanceRecordJpaEntity();
        entity.setClassSessionId(session);
        entity.setAcademicActorId(actor);
        entity.setAttendanceStatus(status);
        entity.setCaptureMethod("MANUAL");
        entity.setCreatedAt(Instant.now());
        entity.setRowVersion(1L);
        repository.save(entity);
    }

    private long total(List<AttendanceGroupCount> rows) {
        return rows.stream().mapToLong(AttendanceGroupCount::getTotal).sum();
    }

    @Test
    void groupsAndFiltersBySessionsAndActors() {
        save(900, 1, "Present");
        save(900, 2, "Absent");
        save(901, 1, "Late");
        save(901, 3, "Present");

        List<AttendanceGroupCount> bySession = repository.countByGroups(true, Set.of(900L), false, Set.of(-1L));
        assertEquals(2, total(bySession));

        List<AttendanceGroupCount> byActor = repository.countByGroups(false, Set.of(-1L), true, Set.of(1L));
        assertEquals(2, total(byActor));

        List<AttendanceGroupCount> both = repository.countByGroups(true, Set.of(901L), true, Set.of(1L, 2L));
        assertEquals(1, total(both));
        assertEquals("Late", both.get(0).getAttendanceStatus());
    }
}
