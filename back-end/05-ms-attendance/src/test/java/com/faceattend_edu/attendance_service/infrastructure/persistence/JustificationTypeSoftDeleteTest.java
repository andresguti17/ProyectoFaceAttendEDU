package com.faceattend_edu.attendance_service.infrastructure.persistence;

import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.JustificationTypeJpaEntity;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.JustificationTypeJpaRepository;
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
 * El borrado de un tipo de justificacion es logico (AGENTS.md 2.2): la fila sigue con
 * {@code deleted_at}, {@code status=false} y {@code row_version} incrementada, y deja de aparecer en
 * las lecturas. Una justificacion ya radicada bajo un tipo borrado conserva su exigencia de adjunto.
 */
@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true"
})
@DisplayName("JustificationTypeJpaRepository: soft delete (H2)")
class JustificationTypeSoftDeleteTest {

    @Autowired
    private JustificationTypeJpaRepository repository;
    @Autowired
    private EntityManager em;

    private JustificationTypeJpaEntity saved(String name, boolean requiresAttachment) {
        JustificationTypeJpaEntity t = new JustificationTypeJpaEntity();
        t.setSchoolId(7);
        t.setName(name);
        t.setRequiresAttachment(requiresAttachment);
        t.setStatus(true);
        t.setCreatedAt(Instant.now());
        return repository.saveAndFlush(t);
    }

    @Test
    @DisplayName("deleteById conserva la fila con deleted_at, status=false y row_version incrementada")
    void deleteByIdKeepsTheRowMarkedDeleted() {
        JustificationTypeJpaEntity t = saved("Incapacidad", true);
        long versionBefore = t.getRowVersion();

        repository.deleteById(t.getJustificationTypeId());
        repository.flush();
        em.clear();

        Object[] row = (Object[]) em.createNativeQuery(
                        "select \"deleted_at\", \"status\", \"row_version\" from {h-schema}\"justification_type\" where \"justification_type_id\" = ?1")
                .setParameter(1, t.getJustificationTypeId())
                .getSingleResult();
        assertNotNull(row[0], "deleted_at debe quedar lleno");
        assertEquals(Boolean.FALSE, row[1]);
        assertTrue(((Number) row[2]).longValue() > versionBefore, "row_version debe incrementarse");
    }

    @Test
    @DisplayName("un tipo borrado no aparece en las lecturas y su nombre queda libre")
    void deletedTypeIsHiddenFromReads() {
        JustificationTypeJpaEntity t = saved("Calamidad", false);
        repository.deleteById(t.getJustificationTypeId());
        repository.flush();
        em.clear();

        assertFalse(repository.findById(t.getJustificationTypeId()).isPresent());
        assertTrue(repository.findByNameAndSchoolId("Calamidad", 7).isEmpty());
        assertTrue(repository.findAll().stream().noneMatch(x -> "Calamidad".equals(x.getName())));
    }

    @Test
    @DisplayName("la exigencia de adjunto se consulta aunque el tipo este borrado")
    void requiresAttachmentSurvivesTheDeletion() {
        JustificationTypeJpaEntity t = saved("Cita medica", true);
        Integer id = t.getJustificationTypeId();
        repository.deleteById(id);
        repository.flush();
        em.clear();

        assertEquals(Boolean.TRUE, repository.findRequiresAttachmentIncludingDeleted(id).orElseThrow());
        assertTrue(repository.findRequiresAttachmentIncludingDeleted(987654).isEmpty());
    }
}
