package com.faceattend_edu.authorization_service.infrastructure.persistence;

import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.RoleJpaEntity;
import com.faceattend_edu.authorization_service.infrastructure.persistence.repository.RoleJpaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests de integracion de persistencia ({@code @DataJpaTest}) sobre base de datos
 * embebida H2, sustituyendo al PostgreSQL real.
 *
 * <p><b>Por que H2:</b> el pom no incluia ninguna base embebida y los tests de
 * integracion previos ({@code @SpringBootTest} + {@code POSTGRES_TEST_URL}) solo
 * corren con un Postgres disponible. Se anadio H2 (scope test, version fijada por el
 * BOM de Boot 4.1.1) para que la suite pase offline y en CI.</p>
 *
 * <p><b>Ojo con application.yml:</b> fija {@code spring.jpa.hibernate.ddl-auto: validate}
 * (el esquema canonico lo crea Liquibase, desactivado aqui). Se sobrescribe a
 * {@code create-drop} para que Hibernate genere el esquema {@code authorization} en H2.</p>
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@DisplayName("IEEE 829 TC-02-010: RoleJpaRepository (H2)")
class RoleJpaRepositoryTest {

    @Autowired
    private RoleJpaRepository repository;

    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    private RoleJpaEntity role(String name) {
        RoleJpaEntity entity = new RoleJpaEntity();
        entity.setRoleName(name);
        entity.setDescription("description of " + name);
        entity.setCreatedAt(Instant.now()); // columna nullable=false
        return entity;
    }

    @Test
    @DisplayName("givenRole_whenSave_thenPersistsWithGeneratedIdAndVersion")
    void givenRole_whenSave_thenPersistsWithGeneratedIdAndVersion() {
        // Arrange
        RoleJpaEntity saved = repository.saveAndFlush(role("INSTRUCTOR"));

        // Act
        Optional<RoleJpaEntity> found = repository.findById(saved.getRoleId());

        // Assert
        assertTrue(found.isPresent());
        assertEquals("INSTRUCTOR", found.get().getRoleName());
        assertEquals("description of INSTRUCTOR", found.get().getDescription());
        assertTrue(saved.getRoleId() > 0); // IDENTITY: generado por la base de datos
    }

    @Test
    @DisplayName("givenExistingName_whenFindByRoleName_thenReturnPresent")
    void givenExistingName_whenFindByRoleName_thenReturnPresent() {
        // Arrange
        repository.saveAndFlush(role("SCHOOL_ADMIN"));

        // Act
        Optional<RoleJpaEntity> found = repository.findByRoleName("SCHOOL_ADMIN");

        // Assert
        assertTrue(found.isPresent());
        assertEquals("SCHOOL_ADMIN", found.get().getRoleName());
    }

    @Test
    @DisplayName("givenUnknownName_whenFindByRoleName_thenReturnEmpty")
    void givenUnknownName_whenFindByRoleName_thenReturnEmpty() {
        // Act
        Optional<RoleJpaEntity> found = repository.findByRoleName("DOES_NOT_EXIST");

        // Assert
        assertFalse(found.isPresent());
    }

    @Test
    @DisplayName("givenDuplicatedRoleName_whenFlush_thenDataIntegrityViolation")
    void givenDuplicatedRoleName_whenFlush_thenDataIntegrityViolation() {
        // Arrange: la columna role_name tiene unique=true (modelo: uq de nombre de rol)
        repository.saveAndFlush(role("STUDENT"));

        // Act & Assert
        RoleJpaEntity duplicate = role("STUDENT");
        assertThrows(DataIntegrityViolationException.class, () -> repository.saveAndFlush(duplicate));
    }

    @Test
    @DisplayName("givenUpdatedRole_whenFlush_thenRowVersionIncrements")
    void givenUpdatedRole_whenFlush_thenRowVersionIncrements() {
        // Arrange: el bloqueo optimista (@Version) exige que row_version suba en cada UPDATE.
        // Hibernate escribe la version vigente en el INSERT (0 para una entidad nueva) y
        // solo incrementa al modificar; por eso se compara contra el valor tras el insert.
        RoleJpaEntity saved = repository.saveAndFlush(role("OLD_NAME"));
        long versionAfterInsert = saved.getRowVersion();

        // Act
        saved.setRoleName("NEW_NAME");
        repository.saveAndFlush(saved);
        entityManager.clear(); // fuerza una relectura real de la base, no del contexto de persistencia

        // Assert
        RoleJpaEntity reloaded = repository.findById(saved.getRoleId()).orElseThrow();
        assertEquals("NEW_NAME", reloaded.getRoleName());
        assertEquals(versionAfterInsert + 1, reloaded.getRowVersion());
    }

    @Test
    @DisplayName("givenMissingCreatedAt_whenFlush_thenDataIntegrityViolation")
    void givenMissingCreatedAt_whenFlush_thenDataIntegrityViolation() {
        // Arrange: created_at es NOT NULL (bloque de auditoria obligatorio)
        RoleJpaEntity withoutAudit = new RoleJpaEntity();
        withoutAudit.setRoleName("NO_AUDIT");

        // Act & Assert
        assertThrows(DataIntegrityViolationException.class, () -> repository.saveAndFlush(withoutAudit));
    }
}
