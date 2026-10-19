package com.faceattend_edu.authorization_service.infrastructure.web.controller;

import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.port.in.*;
import com.faceattend_edu.authorization_service.infrastructure.web.dto.*;
import com.faceattend_edu.authorization_service.infrastructure.web.mapper.RoleWebMapper;
import com.faceattend_edu.authorization_service.infrastructure.web.mapper.PermissionWebMapper;
import com.faceattend_edu.authorization_service.domain.port.out.RolePermissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * IEEE 829 — Test Case Specification
 * Service: 02-ms-authorization
 * Entity: Role
 * Test IDs: TC-02-001 through TC-02-005
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("IEEE 829 TC-02: Role CRUD Tests")
class RoleControllerTest {

    @Mock
    private CreateRoleUseCase createRoleUseCase;
    @Mock
    private UpdateRoleUseCase updateRoleUseCase;
    @Mock
    private GetRoleUseCase getRoleUseCase;
    @Mock
    private ListRolesUseCase listRolesUseCase;
    @Mock
    private DeleteRoleUseCase deleteRoleUseCase;
    @Mock
    private AssignPermissionToRoleUseCase assignPermissionToRoleUseCase;
    @Mock
    private RolePermissionRepository rolePermissionRepository;
    @Mock
    private RoleWebMapper roleWebMapper;
    @Mock
    private PermissionWebMapper permissionWebMapper;

    @InjectMocks
    private RoleController controller;

    private Role sampleRole;
    private RoleResponse sampleResponse;

    @BeforeEach
    void setUp() {
        sampleRole = new Role();
        sampleRole.setRoleId(1);
        sampleRole.setRoleName("ADMIN");
        sampleRole.setDescription("Administrator role");

        sampleResponse = new RoleResponse();
        sampleResponse.setRoleId(1);
        sampleResponse.setRoleName("ADMIN");
        sampleResponse.setDescription("Administrator role");
    }

    @Nested
    @DisplayName("TC-02-001: Create Role")
    class CreateTests {

        @Test
        @DisplayName("Should create role with valid data")
        void shouldCreateRole() {
            // Arrange
            CreateRoleRequest request = new CreateRoleRequest();
            request.setRoleName("ADMIN");
            request.setDescription("Administrator role");

            when(createRoleUseCase.createRole("ADMIN", "Administrator role")).thenReturn(sampleRole);
            when(roleWebMapper.toResponse(any())).thenReturn(sampleResponse);

            // Act
            var response = controller.createRole(request);

            // Assert
            assertEquals(201, response.getStatusCode().value());
            assertNotNull(response.getBody());
            assertEquals("ADMIN", response.getBody().getRoleName());
        }
    }

    @Nested
    @DisplayName("TC-02-002: Get Role by ID")
    class GetByIdTests {

        @Test
        @DisplayName("Should return role when found")
        void shouldReturnRole() {
            // Arrange
            when(getRoleUseCase.getRole(1)).thenReturn(sampleRole);
            when(roleWebMapper.toResponse(any())).thenReturn(sampleResponse);

            // Act
            var response = controller.getRole(1);

            // Assert
            assertEquals(200, response.getStatusCode().value());
            assertNotNull(response.getBody());
            assertEquals(1, response.getBody().getRoleId());
        }

        @Test
        @DisplayName("Should throw exception when role not found")
        void shouldThrowWhenNotFound() {
            // Arrange
            when(getRoleUseCase.getRole(999)).thenThrow(new RuntimeException("Role not found"));

            // Act & Assert
            assertThrows(RuntimeException.class, () -> controller.getRole(999));
        }
    }

    @Nested
    @DisplayName("TC-02-003: Update Role")
    class UpdateTests {

        @Test
        @DisplayName("Should update role description")
        void shouldUpdateRole() {
            // Arrange
            UpdateRoleRequest request = new UpdateRoleRequest();
            request.setRoleName("ADMIN");
            request.setDescription("Updated description");

            Role updatedRole = new Role();
            updatedRole.setRoleId(1);
            updatedRole.setRoleName("ADMIN");
            updatedRole.setDescription("Updated description");

            when(updateRoleUseCase.updateRole(1, "ADMIN", "Updated description")).thenReturn(updatedRole);
            when(roleWebMapper.toResponse(any())).thenReturn(sampleResponse);

            // Act
            var response = controller.updateRole(1, request);

            // Assert
            assertEquals(200, response.getStatusCode().value());
            verify(updateRoleUseCase, times(1)).updateRole(1, "ADMIN", "Updated description");
        }
    }

    @Nested
    @DisplayName("TC-02-004: Delete Role")
    class DeleteTests {

        @Test
        @DisplayName("Should delete role")
        void shouldDeleteRole() {
            // Arrange
            doNothing().when(deleteRoleUseCase).deleteRole(1);

            // Act
            var response = controller.deleteRole(1);

            // Assert
            assertEquals(204, response.getStatusCode().value());
            verify(deleteRoleUseCase, times(1)).deleteRole(1);
        }
    }

    @Nested
    @DisplayName("TC-02-005: List Roles")
    class ListTests {

        @Test
        @DisplayName("Should list all roles")
        void shouldListRoles() {
            // Arrange
            when(listRolesUseCase.listRoles()).thenReturn(Arrays.asList(sampleRole));
            when(roleWebMapper.toResponse(any())).thenReturn(sampleResponse);

            // Act
            var response = controller.listRoles();

            // Assert
            assertEquals(200, response.getStatusCode().value());
            assertFalse(response.getBody().isEmpty());
        }
    }

    @Nested
    @DisplayName("TC-02-006: Assign Permission to Role")
    class AssignPermissionTests {

        @Test
        @DisplayName("Should assign permission to role")
        void shouldAssignPermission() {
            // Arrange
            AssignPermissionRequest request = new AssignPermissionRequest();
            request.setPermissionId(10);

            doNothing().when(assignPermissionToRoleUseCase).assignPermissionToRole(1, 10);

            // Act
            var response = controller.assignPermission(1, request);

            // Assert
            assertEquals(201, response.getStatusCode().value());
            verify(assignPermissionToRoleUseCase, times(1)).assignPermissionToRole(1, 10);
        }
    }
}
