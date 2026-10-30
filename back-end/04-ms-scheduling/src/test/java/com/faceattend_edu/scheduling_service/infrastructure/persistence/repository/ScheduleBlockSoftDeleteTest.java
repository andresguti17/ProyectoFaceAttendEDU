package com.faceattend_edu.scheduling_service.infrastructure.persistence.repository;

import com.faceattend_edu.scheduling_service.infrastructure.persistence.entity.ScheduleBlockJpaEntity;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

import java.time.Instant;
import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * El borrado de un bloque horario es logico (AGENTS.md 2.2): la fila sigue en la tabla con
 * {@code deleted_at} y {@code row_version} incrementada, y deja de aparecer en las lecturas.
 */
@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true"
})
@DisplayName("ScheduleBlockJpaRepository: soft delete (H2)")
class ScheduleBlockSoftDeleteTest {

    @Autowired
    private ScheduleBlockJpaRepository repository;
    @Autowired
    private EntityManager em;

    private ScheduleBlockJpaEntity saved(int room) {
        ScheduleBlockJpaEntity b = new ScheduleBlockJpaEntity();
        b.setCohortId(1L);
        b.setCourseId(1);
        b.setEnvironmentId(room);
        b.setInstructorActorId(700L + room);
        b.setDayOfWeek((short) 3);
        b.setStartsAt(LocalTime.of(7, 0));
        b.setEndsAt(LocalTime.of(9, 0));
        b.setCreatedAt(Instant.now());
        return repository.saveAndFlush(b);
    }

    @Test
    @DisplayName("deleteById conserva la fila con deleted_at y row_version incrementada")
    void deleteByIdKeepsTheRowMarkedDeleted() {
        ScheduleBlockJpaEntity b = saved(801);
        long versionBefore = b.getRowVersion();

        repository.deleteById(b.getScheduleBlockId());
        repository.flush();
        em.clear();

        Object[] row = (Object[]) em.createNativeQuery(
                        "select \"deleted_at\", \"row_version\" from {h-schema}\"schedule_block\" where \"schedule_block_id\" = ?1")
                .setParameter(1, b.getScheduleBlockId())
                .getSingleResult();
        assertNotNull(row[0], "deleted_at debe quedar lleno");
        assertTrue(((Number) row[1]).longValue() > versionBefore, "row_version debe incrementarse");
    }

    @Test
    @DisplayName("un bloque borrado no aparece en las lecturas")
    void deletedBlockIsHiddenFromReads() {
        ScheduleBlockJpaEntity b = saved(802);
        repository.deleteById(b.getScheduleBlockId());
        repository.flush();
        em.clear();

        assertFalse(repository.findById(b.getScheduleBlockId()).isPresent());
        assertFalse(repository.existsById(b.getScheduleBlockId()));
        assertTrue(repository.findAll().stream().noneMatch(x -> b.getScheduleBlockId().equals(x.getScheduleBlockId())));
    }

    @Test
    @DisplayName("existsByEnvironmentId solo cuenta los bloques vivos")
    void existsByEnvironmentIdIgnoresDeletedBlocks() {
        ScheduleBlockJpaEntity b = saved(803);
        assertTrue(repository.existsByEnvironmentId(803));

        repository.deleteById(b.getScheduleBlockId());
        repository.flush();
        em.clear();

        assertFalse(repository.existsByEnvironmentId(803));
    }
}
