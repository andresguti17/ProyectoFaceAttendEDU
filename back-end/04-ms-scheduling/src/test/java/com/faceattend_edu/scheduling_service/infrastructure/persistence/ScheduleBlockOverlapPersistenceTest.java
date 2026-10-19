package com.faceattend_edu.scheduling_service.infrastructure.persistence;

import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.out.ScheduleBlockRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The overlap queries against a real PostgreSQL (schema created by Hibernate).
 * Skipped unless POSTGRES_TEST_URL is set, for example
 * {@code POSTGRES_TEST_URL=jdbc:postgresql://localhost:5432/faceattend_test}
 * with POSTGRES_USER / POSTGRES_PASSWORD, so a plain {@code mvn test} stays offline.
 */
@EnabledIfEnvironmentVariable(named = "POSTGRES_TEST_URL", matches = ".+")
@SpringBootTest
class ScheduleBlockOverlapPersistenceTest {

    private static final int ROOM = 501;
    private static final long INSTRUCTOR = 601L;
    private static final short MONDAY = 1;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("POSTGRES_TEST_URL"));
        registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("POSTGRES_USER", "postgres"));
        registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("POSTGRES_PASSWORD", "postgres"));
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create");
    }

    @Autowired ScheduleBlockRepository repository;

    private ScheduleBlock block(int room, long instructor, LocalTime from, LocalTime to) {
        ScheduleBlock block = new ScheduleBlock();
        block.setCohortId(1L);
        block.setCourseId(1);
        block.setEnvironmentId(room);
        block.setInstructorActorId(instructor);
        block.setDayOfWeek(MONDAY);
        block.setStartsAt(from);
        block.setEndsAt(to);
        block.touchCreated();
        return block;
    }

    @Test
    void detectsIntersectingRangesButNotTouchingOnes() {
        ScheduleBlock saved = repository.save(block(ROOM, INSTRUCTOR, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        // Different start, intersecting range: the case the unique constraint missed.
        assertTrue(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), null));
        assertTrue(repository.existsInstructorOverlap(INSTRUCTOR, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), null));
        // Fully contained and fully containing.
        assertTrue(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(8, 30), LocalTime.of(9, 0), null));
        assertTrue(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(7, 0), LocalTime.of(12, 0), null));
        // Back-to-back classes are fine.
        assertFalse(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(10, 0), LocalTime.of(12, 0), null));
        assertFalse(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(6, 0), LocalTime.of(8, 0), null));
        // Another room, another weekday or another instructor are free.
        assertFalse(repository.existsEnvironmentOverlap(ROOM + 1, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), null));
        assertFalse(repository.existsEnvironmentOverlap(ROOM, (short) 2, LocalTime.of(9, 0), LocalTime.of(11, 0), null));
        assertFalse(repository.existsInstructorOverlap(INSTRUCTOR + 1, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), null));
        // Editing the block itself must not collide with its own previous range.
        assertFalse(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), saved.getScheduleBlockId()));
    }
}
