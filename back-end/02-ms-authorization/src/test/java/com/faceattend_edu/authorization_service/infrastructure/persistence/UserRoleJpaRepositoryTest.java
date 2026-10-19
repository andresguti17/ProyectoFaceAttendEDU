package com.faceattend_edu.authorization_service.infrastructure.persistence;

import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.UserRoleId;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.UserRoleJpaEntity;
import com.faceattend_edu.authorization_service.infrastructure.persistence.repository.UserRoleJpaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests {@code @DataJpaTest} (H2) para la tabla puente {@code user_role},
 * cuya PK es COMPUESTA {@code (user_id, role_id)} — caso tipico de error en JPA
 * ({@code @IdClass}).
 *
 * <p>Verifica ademas los metodos que usa la aplicacion: {@code exists} para detectar
 * duplicados antes de insertar, {@code findByUserIdIn} para el batch de usuarios y
 * la {@code @Query} explicita {@code findAllByUserId}.</p>
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@DisplayName("IEEE 829 TC-02-011: UserRoleJpaRepository (H2, PK compuesta)")
class UserRoleJpaRepositoryTest {

    @Autowired
    private UserRoleJpaRepository repository;

    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    private static final UUID USER_1 = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_2 = UUID.fromString("22222222-2222-2222-2222-222222222222");

    private UserRoleJpaEntity assignment(UUID userId, Integer roleId) {
        UserRoleJpaEntity entity = new UserRoleJpaEntity();
        entity.setUserId(userId);
        entity.setRoleId(roleId);
        entity.setAssignmentDate(Instant.now()); // nullable=false
        entity.setCreatedAt(Instant.now());      // nullable=false
        entity.setRowVersion(1L);                // nullable=false (sin @Version en esta tabla)
        return entity;
    }

    @Test
    @DisplayName("givenAssignment_whenSave_thenFoundByCompositeId")
    void givenAssignment_whenSave_thenFoundByCompositeId() {
        // Arrange
        repository.saveAndFlush(assignment(USER_1, 3));

        // Act & Assert: la identidad es la pareja completa (userId, roleId)
        assertTrue(repository.existsById(new UserRoleId(USER_1, 3)));
        assertTrue(repository.existsByUserIdAndRoleId(USER_1, 3));
        assertFalse(repository.existsByUserIdAndRoleId(USER_1, 99));
        assertEquals(1, repository.findByUserId(USER_1).size());
        assertEquals(3, repository.findByUserId(USER_1).get(0).getRoleId());
    }

    @Test
    @DisplayName("givenMissingAssignment_whenSave_thenReturnEmpty")
    void givenMissingAssignment_whenSave_thenReturnEmpty() {
        // Act & Assert
        assertFalse(repository.existsByUserIdAndRoleId(USER_2, 1));
        assertTrue(repository.findByUserId(USER_2).isEmpty());
    }

    @Test
    @DisplayName("givenDuplicatedCompositeKey_whenFlush_thenDataIntegrityViolation")
    void givenDuplicatedCompositeKey_whenFlush_thenDataIntegrityViolation() {
        // Arrange: (user_id, role_id) es la PK; el segundo INSERT identico debe fallar.
        // OJO: repository.save() con la PK ya seteada llama a MERGE, que localiza la fila
        // existente y la actualiza sin violar nada; y persist() sin mas lanza
        // EntityExistsException porque la copia gestionada sigue en el contexto de
        // persistencia. Se limpia el contexto para forzar el INSERT duplicado real
        // contra la base de datos (asi se comprueba el constraint de la tabla).
        repository.saveAndFlush(assignment(USER_1, 1));
        entityManager.clear();

        // Act & Assert: el flush directo del EntityManager NO pasa por el traductor de
        // excepciones de Spring (eso lo hace el proxy del repositorio, como en el test de
        // role_name), por eso el tipo que sale es el de Hibernate, ConstraintViolationException.
        UserRoleJpaEntity duplicate = assignment(USER_1, 1);
        entityManager.persist(duplicate);
        assertThrows(org.hibernate.exception.ConstraintViolationException.class,
                () -> entityManager.flush());
    }

    @Test
    @DisplayName("givenMissingAssignmentDate_whenFlush_thenDataIntegrityViolation")
    void givenMissingAssignmentDate_whenFlush_thenDataIntegrityViolation() {
        // Arrange: assignment_date es NOT NULL
        UserRoleJpaEntity entity = assignment(USER_1, 1);
        entity.setAssignmentDate(null);

        // Act & Assert
        assertThrows(DataIntegrityViolationException.class, () -> repository.saveAndFlush(entity));
    }

    @Test
    @DisplayName("givenTwoUsers_whenFindByUserIdIn_thenReturnOnlyTheirAssignments")
    void givenTwoUsers_whenFindByUserIdIn_thenReturnOnlyTheirAssignments() {
        // Arrange: 2 roles para USER_1 y 1 para USER_2
        repository.saveAndFlush(assignment(USER_1, 1));
        repository.saveAndFlush(assignment(USER_1, 4));
        repository.saveAndFlush(assignment(USER_2, 4));

        // Act & Assert: el IN clause del batch de usuarios
        assertEquals(2, repository.findByUserIdIn(List.of(USER_1)).size());
        assertEquals(3, repository.findByUserIdIn(List.of(USER_1, USER_2)).size());
        assertTrue(repository.findByUserIdIn(List.of(UUID.randomUUID())).isEmpty());
    }

    @Test
    @DisplayName("givenAssignments_whenFindAllByUserId_thenReturnSameAsDerivedQuery")
    void givenAssignments_whenFindAllByUserId_thenReturnSameAsDerivedQuery() {
        // Arrange: la @Query explicita y el metodo derivado deben comportarse igual
        repository.saveAndFlush(assignment(USER_1, 1));
        repository.saveAndFlush(assignment(USER_1, 4));

        // Act
        List<UserRoleJpaEntity> byQuery = repository.findAllByUserId(USER_1);
        List<UserRoleJpaEntity> byDerived = repository.findByUserId(USER_1);

        // Assert
        assertEquals(byDerived.size(), byQuery.size());
        assertEquals(2, byQuery.size());
    }
}
