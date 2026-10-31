package com.faceattend_edu.scheduling_service.infrastructure.persistence.repository;

import com.faceattend_edu.scheduling_service.infrastructure.persistence.entity.EnvironmentJpaEntity;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * El borrado de un ambiente es logico (AGENTS.md 2.2): la fila sigue en la tabla con
 * {@code deleted_at}, {@code status=false} y {@code row_version} incrementada, y deja de
 * aparecer en las lecturas del repositorio.
 */
@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true"
})
@DisplayName("EnvironmentJpaRepository: soft delete (H2)")
class EnvironmentJpaRepositoryTest {

    @Autowired
    private EnvironmentJpaRepository repository;
    @Autowired
    private EntityManager em;

    private EnvironmentJpaEntity saved(String code) {
        EnvironmentJpaEntity e = new EnvironmentJpaEntity();
        e.setSchoolId(1);
        e.setCode(code);
        e.setName("Aula " + code);
        e.setCapacity((short) 30);
        e.setStatus(true);
        e.setCreatedAt(Instant.now());
        return repository.saveAndFlush(e);
    }

    private Object[] rawRow(int id) {
        return (Object[]) em.createNativeQuery(
                        "select \"deleted_at\", \"status\", \"row_version\" from {h-schema}\"environment\" where \"environment_id\" = ?1")
                .setParameter(1, id)
                .getSingleResult();
    }

    @Test
    @DisplayName("deleteById conserva la fila con deleted_at y status=false")
    void deleteByIdKeepsTheRowMarkedDeleted() {
        EnvironmentJpaEntity e = saved("S-1");
        long versionBefore = e.getRowVersion();

        repository.deleteById(e.getEnvironmentId());
        repository.flush();
        em.clear();

        Object[] row = rawRow(e.getEnvironmentId());
        assertNotNull(row[0], "deleted_at debe quedar lleno");
        assertEquals(Boolean.FALSE, row[1]);
        assertTrue(((Number) row[2]).longValue() > versionBefore, "row_version debe incrementarse");
    }

    @Test
    @DisplayName("un ambiente borrado no aparece en las lecturas")
    void deletedEnvironmentIsHiddenFromReads() {
        EnvironmentJpaEntity e = saved("S-2");
        repository.deleteById(e.getEnvironmentId());
        repository.flush();
        em.clear();

        assertFalse(repository.findById(e.getEnvironmentId()).isPresent());
        assertFalse(repository.existsById(e.getEnvironmentId()));
        assertTrue(repository.findBySchoolIdAndCode(1, "S-2").isEmpty());
        assertTrue(repository.findBySchoolId(1).stream().noneMatch(x -> "S-2".equals(x.getCode())));
        assertTrue(repository.findAll().stream().noneMatch(x -> "S-2".equals(x.getCode())));
    }
}
