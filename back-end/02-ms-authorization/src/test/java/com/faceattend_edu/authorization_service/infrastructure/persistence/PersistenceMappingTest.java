package com.faceattend_edu.authorization_service.infrastructure.persistence;

import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.model.RolePermission;
import com.faceattend_edu.authorization_service.domain.model.UserRole;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.PermissionPersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.RolePermissionPersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.RolePersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.UserRolePersistenceMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Persistence mappers keep every column, audit fields included")
class PersistenceMappingTest {

    private static final Instant CREATED = Instant.parse("2026-10-01T10:00:00Z");
    private static final Instant UPDATED = Instant.parse("2026-10-02T10:00:00Z");
    private static final Instant DELETED = Instant.parse("2026-10-03T10:00:00Z");
    private static final UUID BY = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID USER = UUID.fromString("22222222-2222-4222-8222-222222222222");

    @Test
    void roleRoundTrip() {
        Role role = new Role();
        role.setRoleId(3);
        role.setRoleName("Administrador");
        role.setDescription("Administra la sede");
        role.setCreatedAt(CREATED);
        role.setUpdatedAt(UPDATED);
        role.setDeletedAt(DELETED);
        role.setCreatedBy(BY);
        role.setUpdatedBy(BY);
        role.setDeletedBy(BY);
        role.setRowVersion(7);
        RolePersistenceMapper mapper = new RolePersistenceMapper();

        var entity = mapper.toEntity(role);
        assertThat(entity.getRoleName()).isEqualTo("Administrador");
        assertThat(entity.getRowVersion()).isEqualTo(7);
        assertThat(mapper.toDomain(entity)).usingRecursiveComparison().isEqualTo(role);
        assertThat(mapper.toDomain(null)).isNull();
        assertThat(mapper.toEntity(null)).isNull();
    }

    @Test
    void permissionRoundTrip() {
        Permission permission = new Permission();
        permission.setPermissionId(9);
        permission.setPermissionName("attendance.record:read");
        permission.setDescription("Leer asistencia");
        permission.setCreatedAt(CREATED);
        permission.setUpdatedAt(UPDATED);
        permission.setDeletedAt(null);
        permission.setCreatedBy(BY);
        permission.setUpdatedBy(null);
        permission.setDeletedBy(null);
        permission.setRowVersion(2);
        PermissionPersistenceMapper mapper = new PermissionPersistenceMapper();

        var entity = mapper.toEntity(permission);
        assertThat(entity.getPermissionName()).isEqualTo("attendance.record:read");
        assertThat(mapper.toDomain(entity)).usingRecursiveComparison().isEqualTo(permission);
        assertThat(mapper.toDomain(null)).isNull();
        assertThat(mapper.toEntity(null)).isNull();
    }

    @Test
    void userRoleRoundTrip() {
        UserRole assignment = new UserRole();
        assignment.setUserId(USER);
        assignment.setRoleId(3);
        assignment.setAssignmentDate(CREATED);
        assignment.setCreatedAt(CREATED);
        assignment.setUpdatedAt(UPDATED);
        assignment.setDeletedAt(DELETED);
        assignment.setCreatedBy(BY);
        assignment.setUpdatedBy(BY);
        assignment.setDeletedBy(BY);
        assignment.setRowVersion(1);
        UserRolePersistenceMapper mapper = new UserRolePersistenceMapper();

        var entity = mapper.toEntity(assignment);
        assertThat(entity.getUserId()).isEqualTo(USER);
        assertThat(mapper.toDomain(entity)).usingRecursiveComparison().isEqualTo(assignment);
        assertThat(mapper.toDomain(null)).isNull();
        assertThat(mapper.toEntity(null)).isNull();
    }

    @Test
    void rolePermissionRoundTrip() {
        RolePermission grant = new RolePermission();
        grant.setRoleId(3);
        grant.setPermissionId(9);
        grant.setAssignmentDate(CREATED);
        grant.setCreatedAt(CREATED);
        grant.setUpdatedAt(UPDATED);
        grant.setDeletedAt(DELETED);
        grant.setCreatedBy(BY);
        grant.setUpdatedBy(BY);
        grant.setDeletedBy(BY);
        grant.setRowVersion(4);
        RolePermissionPersistenceMapper mapper = new RolePermissionPersistenceMapper();

        var entity = mapper.toEntity(grant);
        assertThat(entity.getPermissionId()).isEqualTo(9);
        assertThat(mapper.toDomain(entity)).usingRecursiveComparison().isEqualTo(grant);
        assertThat(mapper.toDomain(null)).isNull();
        assertThat(mapper.toEntity(null)).isNull();
    }
}
