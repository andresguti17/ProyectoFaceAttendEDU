package com.faceattend_edu.scheduling_service.infrastructure.persistence.repository;

import com.faceattend_edu.scheduling_service.infrastructure.persistence.entity.ScheduleBlockJpaEntity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests de integracion de persistencia ({@code @DataJpaTest} sobre H2) de
 * {@code ScheduleBlockJpaRepository}.
 *
 * <p>Cubren los {@code @Query} REALES de solape ({@code existsEnvironmentOverlap} /
 * {@code existsInstructorOverlap}): rangos solapados parcialmente, contenidos y
 * contenedores; rangos que solo se tocan (back-to-back, NO solapan); otra sala,
 * otro dia u otro instructor; {@code excludeId} que excluye el propio bloque; y
 * bloques borrados logicamente ({@code deletedAt}) que ya no bloquean el slot.
 * Tambien los constraints unicos {@code uq_block_environment_slot} y
 * {@code uq_block_instructor_slot}.</p>
 *
 * <p>{@code application.yml} fija {@code ddl-auto: validate} y
 * {@code hibernate.default_schema: scheduling}; se sobrescribe a
 * {@code create-drop} (y se refuerza {@code create_namespaces}) para que Hibernate
 * genere el esquema {@code scheduling} en H2, igual que en 02-ms-authorization.</p>
 */
@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true"
})
@DisplayName("IEEE 829 TC-04-004: ScheduleBlockJpaRepository overlap queries (H2)")
class ScheduleBlockJpaRepositoryTest {

    private static final int ROOM = 501;
    private static final long INSTRUCTOR = 601L;
    private static final short MONDAY = 1;
    private static final short TUESDAY = 2;

    @Autowired
    private ScheduleBlockJpaRepository repository;

    private ScheduleBlockJpaEntity block(Integer room, long instructor, short day, LocalTime from, LocalTime to) {
        ScheduleBlockJpaEntity entity = new ScheduleBlockJpaEntity();
        entity.setCohortId(1L);
        entity.setCourseId(1);
        entity.setEnvironmentId(room);
        entity.setInstructorActorId(instructor);
        entity.setDayOfWeek(day);
        entity.setStartsAt(from);
        entity.setEndsAt(to);
        entity.setCreatedAt(Instant.now()); // columna nullable=false
        return entity;
    }

    @Test
    @DisplayName("givenPartiallyOverlappingRange_whenQuery_thenReturnOverlapForRoomAndInstructor")
    void givenPartiallyOverlappingRange_whenQuery_thenReturnOverlapForRoomAndInstructor() {
        // Arrange: lunes 08:00-10:00 en sala 501 con instructor 601
        repository.saveAndFlush(block(ROOM, INSTRUCTOR, MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        // Act & Assert: 09:00-11:00 empieza dentro y termina fuera -> solapa
        assertTrue(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), null));
        assertTrue(repository.existsInstructorOverlap(INSTRUCTOR, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), null));
    }

    @Test
    @DisplayName("givenContainedAndContainingRanges_whenQuery_thenReturnOverlap")
    void givenContainedAndContainingRanges_whenQuery_thenReturnOverlap() {
        // Arrange
        repository.saveAndFlush(block(ROOM, INSTRUCTOR, MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        // Act & Assert: contenido (08:30-09:00) y contenedor (07:00-12:00)
        assertTrue(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(8, 30), LocalTime.of(9, 0), null));
        assertTrue(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(7, 0), LocalTime.of(12, 0), null));
        assertTrue(repository.existsInstructorOverlap(INSTRUCTOR, MONDAY, LocalTime.of(8, 30), LocalTime.of(9, 0), null));
        assertTrue(repository.existsInstructorOverlap(INSTRUCTOR, MONDAY, LocalTime.of(7, 0), LocalTime.of(12, 0), null));
    }

    @Test
    @DisplayName("givenBackToBackRanges_whenQuery_thenReturnNoOverlap")
    void givenBackToBackRanges_whenQuery_thenReturnNoOverlap() {
        // Arrange: 08:00-10:00 existente; 10:00-12:00 y 06:00-08:00 solo se tocan
        repository.saveAndFlush(block(ROOM, INSTRUCTOR, MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        // Act & Assert: fin==inicio NO es solape (el < / > estricto del @Query)
        assertFalse(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(10, 0), LocalTime.of(12, 0), null));
        assertFalse(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(6, 0), LocalTime.of(8, 0), null));
        assertFalse(repository.existsInstructorOverlap(INSTRUCTOR, MONDAY, LocalTime.of(10, 0), LocalTime.of(12, 0), null));
        assertFalse(repository.existsInstructorOverlap(INSTRUCTOR, MONDAY, LocalTime.of(6, 0), LocalTime.of(8, 0), null));
    }

    @Test
    @DisplayName("givenDifferentRoomDayOrInstructor_whenQuery_thenReturnNoOverlap")
    void givenDifferentRoomDayOrInstructor_whenQuery_thenReturnNoOverlap() {
        // Arrange
        repository.saveAndFlush(block(ROOM, INSTRUCTOR, MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        // Act & Assert: otra sala, otro dia u otro instructor estan libres
        assertFalse(repository.existsEnvironmentOverlap(ROOM + 1, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), null));
        assertFalse(repository.existsEnvironmentOverlap(ROOM, TUESDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), null));
        assertFalse(repository.existsInstructorOverlap(INSTRUCTOR + 1, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), null));
    }

    @Test
    @DisplayName("givenExcludeIdOfOwnBlock_whenQuery_thenReturnNoOverlap")
    void givenExcludeIdOfOwnBlock_whenQuery_thenReturnNoOverlap() {
        // Arrange: al editar un bloque su propio rango previo no debe chocarle
        ScheduleBlockJpaEntity saved =
                repository.saveAndFlush(block(ROOM, INSTRUCTOR, MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0)));
        assertNotNull(saved.getScheduleBlockId());

        // Act & Assert
        assertFalse(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), saved.getScheduleBlockId()));
        assertFalse(repository.existsInstructorOverlap(INSTRUCTOR, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), saved.getScheduleBlockId()));
        // ...pero un tercer bloque en el mismo slot SI sigue contando
        assertTrue(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), saved.getScheduleBlockId() + 1000));
    }

    @Test
    @DisplayName("givenSoftDeletedBlock_whenQuery_thenReturnNoOverlap")
    void givenSoftDeletedBlock_whenQuery_thenReturnNoOverlap() {
        // Arrange: deleted_at NOT NULL = borrado logico; ya no debe bloquear el slot
        ScheduleBlockJpaEntity deleted = block(ROOM, INSTRUCTOR, MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0));
        deleted.setDeletedAt(Instant.now());
        repository.saveAndFlush(deleted);

        // Act & Assert
        assertFalse(repository.existsEnvironmentOverlap(ROOM, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), null));
        assertFalse(repository.existsInstructorOverlap(INSTRUCTOR, MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0), null));
    }

    @Test
    @DisplayName("givenSameEnvironmentSlot_whenFlush_thenDataIntegrityViolation")
    void givenSameEnvironmentSlot_whenFlush_thenDataIntegrityViolation() {
        // Arrange: uq_block_environment_slot (environment_id, day_of_week, starts_at)
        repository.saveAndFlush(block(ROOM, INSTRUCTOR, MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        // Act & Assert: mismo dia/hora de inicio en la misma sala, otro instructor
        ScheduleBlockJpaEntity duplicate = block(ROOM, 702L, MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0));
        assertThrows(DataIntegrityViolationException.class, () -> repository.saveAndFlush(duplicate));
    }

    @Test
    @DisplayName("givenSameInstructorSlot_whenFlush_thenDataIntegrityViolation")
    void givenSameInstructorSlot_whenFlush_thenDataIntegrityViolation() {
        // Arrange: uq_block_instructor_slot (instructor_actor_id, day_of_week, starts_at)
        repository.saveAndFlush(block(ROOM, INSTRUCTOR, MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        // Act & Assert: mismo instructor/dia/hora de inicio, otra sala
        ScheduleBlockJpaEntity duplicate = block(ROOM + 1, INSTRUCTOR, MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0));
        assertThrows(DataIntegrityViolationException.class, () -> repository.saveAndFlush(duplicate));
    }

    @Test
    @DisplayName("givenSavedBlock_whenFlush_thenGeneratedIdAndVersion")
    void givenSavedBlock_whenFlush_thenGeneratedIdAndVersion() {
        // Arrange & Act: IDENTITY genera el id en el propio INSERT
        ScheduleBlockJpaEntity saved =
                repository.saveAndFlush(block(ROOM, INSTRUCTOR, MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        // Assert
        assertNotNull(saved.getScheduleBlockId());
        assertTrue(saved.getScheduleBlockId() > 0);
        assertEquals(0L, saved.getRowVersion()); // @Version arranca en 0 en el INSERT
    }
}
