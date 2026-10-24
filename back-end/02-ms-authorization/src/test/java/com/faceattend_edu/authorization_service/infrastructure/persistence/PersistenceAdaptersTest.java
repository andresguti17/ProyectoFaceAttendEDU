package com.faceattend_edu.authorization_service.infrastructure.persistence;

import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.model.RolePermission;
import com.faceattend_edu.authorization_service.domain.model.UserRole;
import com.faceattend_edu.authorization_service.infrastructure.persistence.adapter.PermissionPersistenceAdapter;
import com.faceattend_edu.authorization_service.infrastructure.persistence.adapter.RolePermissionPersistenceAdapter;
import com.faceattend_edu.authorization_service.infrastructure.persistence.adapter.RolePersistenceAdapter;
import com.faceattend_edu.authorization_service.infrastructure.persistence.adapter.UserRolePersistenceAdapter;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.PermissionJpaEntity;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.RoleJpaEntity;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.RolePermissionId;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.RolePermissionJpaEntity;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.UserRoleId;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.UserRoleJpaEntity;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.PermissionPersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.RolePermissionPersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.RolePersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.UserRolePersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.repository.PermissionJpaRepository;
import com.faceattend_edu.authorization_service.infrastructure.persistence.repository.RoleJpaRepository;
import com.faceattend_edu.authorization_service.infrastructure.persistence.repository.RolePermissionJpaRepository;
import com.faceattend_edu.authorization_service.infrastructure.persistence.repository.UserRoleJpaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("Persistence adapters over Spring Data")
class PersistenceAdaptersTest {

    private static final UUID ANA = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID LUIS = UUID.fromString("22222222-2222-4222-8222-222222222222");

    private static RoleJpaEntity role(int id, String name) {
        RoleJpaEntity e = new RoleJpaEntity();
        e.setRoleId(id);
        e.setRoleName(name);
        return e;
    }

    private static PermissionJpaEntity permission(int id, String name) {
        PermissionJpaEntity e = new PermissionJpaEntity();
        e.setPermissionId(id);
        e.setPermissionName(name);
        return e;
    }

    private static UserRoleJpaEntity assignment(UUID user, int roleId) {
        UserRoleJpaEntity e = new UserRoleJpaEntity();
        e.setUserId(user);
        e.setRoleId(roleId);
        return e;
    }

    @Nested
    class UserRoles {
        private final UserRoleJpaRepository jpa = mock(UserRoleJpaRepository.class);
        private final RoleJpaRepository roles = mock(RoleJpaRepository.class);
        private final UserRolePersistenceAdapter adapter =
                new UserRolePersistenceAdapter(jpa, roles, new UserRolePersistenceMapper(), new RolePersistenceMapper());

        @Test
        void resolvesRolesForManyUsersWithOneRolesQueryAndSkipsDeletedRoles() {
            when(jpa.findByUserIdIn(Set.of(ANA, LUIS))).thenReturn(List.of(assignment(ANA, 1), assignment(ANA, 2), assignment(LUIS, 2), assignment(LUIS, 99)));
            when(roles.findAllById(anyCollection())).thenReturn(List.of(role(1, "Instructor"), role(2, "Aprendiz")));

            Map<UUID, List<Role>> byUser = adapter.findRolesByUserIds(List.of(ANA, LUIS));

            assertThat(byUser.get(ANA)).extracting(Role::getRoleName).containsExactlyInAnyOrder("Instructor", "Aprendiz");
            assertThat(byUser.get(LUIS)).extracting(Role::getRoleName).containsExactly("Aprendiz");
            verify(roles, times(1)).findAllById(anyCollection());
        }

        @Test
        void noUsersOrNoAssignmentsMeansNoQueriesAndAnEmptyAnswer() {
            assertThat(adapter.findRolesByUserIds(List.of())).isEmpty();
            assertThat(adapter.findRolesByUserIds(null)).isEmpty();
            when(jpa.findByUserId(ANA)).thenReturn(List.of());
            assertThat(adapter.findRolesByUserId(ANA)).isEmpty();
            verify(roles, never()).findAllById(any());
        }

        @Test
        void savesDeletesChecksAndListsAssignments() {
            when(jpa.save(any())).thenAnswer(inv -> inv.getArgument(0));
            UserRole toSave = new UserRole();
            toSave.setUserId(ANA);
            toSave.setRoleId(1);
            assertThat(adapter.save(toSave).getRoleId()).isEqualTo(1);

            adapter.delete(ANA, 1);
            verify(jpa).deleteById(new UserRoleId(ANA, 1));

            when(jpa.existsByUserIdAndRoleId(ANA, 1)).thenReturn(true);
            assertThat(adapter.exists(ANA, 1)).isTrue();

            when(jpa.findByUserId(ANA)).thenReturn(List.of(assignment(ANA, 1)));
            when(roles.findAllById(anyCollection())).thenReturn(List.of(role(1, "Instructor")));
            assertThat(adapter.findByUserId(ANA)).extracting(UserRole::getRoleId).containsExactly(1);
            assertThat(adapter.findRolesByUserId(ANA)).extracting(Role::getRoleName).containsExactly("Instructor");
        }
    }

    @Nested
    class RolePermissions {
        private final RolePermissionJpaRepository jpa = mock(RolePermissionJpaRepository.class);
        private final PermissionJpaRepository permissions = mock(PermissionJpaRepository.class);
        private final RolePermissionPersistenceAdapter adapter = new RolePermissionPersistenceAdapter(
                jpa, permissions, new RolePermissionPersistenceMapper(), new PermissionPersistenceMapper());

        @Test
        void listsTheRolePermissionsAndIgnoresGrantsToMissingPermissions() {
            RolePermissionJpaEntity read = new RolePermissionJpaEntity();
            read.setRoleId(3);
            read.setPermissionId(9);
            RolePermissionJpaEntity gone = new RolePermissionJpaEntity();
            gone.setRoleId(3);
            gone.setPermissionId(10);
            when(jpa.findByRoleId(3)).thenReturn(List.of(read, gone));
            when(permissions.findById(9)).thenReturn(Optional.of(permission(9, "attendance.record:read")));
            when(permissions.findById(10)).thenReturn(Optional.empty());

            assertThat(adapter.findPermissionsByRoleId(3)).extracting(Permission::getPermissionName).containsExactly("attendance.record:read");
            assertThat(adapter.findByRoleId(3)).extracting(RolePermission::getPermissionId).containsExactly(9, 10);
        }

        @Test
        void savesDeletesAndChecksGrants() {
            when(jpa.save(any())).thenAnswer(inv -> inv.getArgument(0));
            RolePermission grant = new RolePermission();
            grant.setRoleId(3);
            grant.setPermissionId(9);
            assertThat(adapter.save(grant).getPermissionId()).isEqualTo(9);
            adapter.delete(3, 9);
            verify(jpa).deleteById(new RolePermissionId(3, 9));
            when(jpa.existsByRoleIdAndPermissionId(3, 9)).thenReturn(true);
            assertThat(adapter.exists(3, 9)).isTrue();
        }
    }

    @Nested
    class RolesAndPermissions {
        @Test
        void roleAdapterDelegatesAndMaps() {
            RoleJpaRepository jpa = mock(RoleJpaRepository.class);
            RolePersistenceAdapter adapter = new RolePersistenceAdapter(jpa, new RolePersistenceMapper());
            when(jpa.save(any())).thenAnswer(inv -> inv.getArgument(0));
            Role newRole = new Role();
            newRole.setRoleName("Coordinador");
            assertThat(adapter.save(newRole).getRoleName()).isEqualTo("Coordinador");
            when(jpa.findById(1)).thenReturn(Optional.of(role(1, "Instructor")));
            assertThat(adapter.findById(1)).map(Role::getRoleName).contains("Instructor");
            when(jpa.findByRoleName("Aprendiz")).thenReturn(Optional.empty());
            assertThat(adapter.findByRoleName("Aprendiz")).isEmpty();
            when(jpa.findAll()).thenReturn(List.of(role(1, "Instructor"), role(2, "Aprendiz")));
            assertThat(adapter.findAll()).hasSize(2);
            adapter.deleteById(2);
            verify(jpa).deleteById(2);
            when(jpa.existsById(2)).thenReturn(false);
            assertThat(adapter.existsById(2)).isFalse();
        }

        @Test
        void permissionAdapterDelegatesAndMaps() {
            PermissionJpaRepository jpa = mock(PermissionJpaRepository.class);
            PermissionPersistenceAdapter adapter = new PermissionPersistenceAdapter(jpa, new PermissionPersistenceMapper());
            when(jpa.save(any())).thenAnswer(inv -> inv.getArgument(0));
            Permission p = new Permission();
            p.setPermissionName("x:y");
            assertThat(adapter.save(p).getPermissionName()).isEqualTo("x:y");
            when(jpa.findById(9)).thenReturn(Optional.of(permission(9, "attendance.record:read")));
            assertThat(adapter.findById(9)).map(Permission::getPermissionName).contains("attendance.record:read");
            when(jpa.findByPermissionName("x:y")).thenReturn(Optional.of(permission(10, "x:y")));
            assertThat(adapter.findByPermissionName("x:y")).map(Permission::getPermissionId).contains(10);
            when(jpa.findAll()).thenReturn(List.of(permission(9, "a"), permission(10, "b")));
            assertThat(adapter.findAll()).extracting(Permission::getPermissionName).containsExactly("a", "b");
            adapter.deleteById(9);
            verify(jpa).deleteById(9);
            when(jpa.existsById(9)).thenReturn(true);
            assertThat(adapter.existsById(9)).isTrue();
        }
    }
}
