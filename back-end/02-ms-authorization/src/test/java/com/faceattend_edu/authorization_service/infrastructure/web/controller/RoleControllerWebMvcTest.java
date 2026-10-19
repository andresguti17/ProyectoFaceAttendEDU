package com.faceattend_edu.authorization_service.infrastructure.web.controller;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.port.in.AssignPermissionToRoleUseCase;
import com.faceattend_edu.authorization_service.domain.port.in.CreateRoleUseCase;
import com.faceattend_edu.authorization_service.domain.port.in.DeleteRoleUseCase;
import com.faceattend_edu.authorization_service.domain.port.in.GetRoleUseCase;
import com.faceattend_edu.authorization_service.domain.port.in.ListRolesUseCase;
import com.faceattend_edu.authorization_service.domain.port.in.UpdateRoleUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.RolePermissionRepository;
import com.faceattend_edu.authorization_service.infrastructure.web.mapper.PermissionWebMapper;
import com.faceattend_edu.authorization_service.infrastructure.web.mapper.RoleWebMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Cobertura HTTP (MockMvc) de {@code RoleController}.
 *
 * <p>Complementa al {@code RoleControllerTest} existente (que invoca los metodos del
 * controller directamente): aqui se valida lo que solo se ve por HTTP — rutas duales
 * ({@code /api/v1/roles} y {@code /roles}), serializacion JSON real, validacion
 * {@code @Valid} del DTO y el envelope ISO/9001 del {@code GlobalExceptionHandler}.</p>
 */
@WebMvcTest(controllers = RoleController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({RoleWebMapper.class, PermissionWebMapper.class})
@DisplayName("IEEE 829 TC-02-009: RoleController HTTP tests (MockMvc)")
class RoleControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CreateRoleUseCase createRoleUseCase;
    @MockitoBean
    private UpdateRoleUseCase updateRoleUseCase;
    @MockitoBean
    private GetRoleUseCase getRoleUseCase;
    @MockitoBean
    private ListRolesUseCase listRolesUseCase;
    @MockitoBean
    private DeleteRoleUseCase deleteRoleUseCase;
    @MockitoBean
    private AssignPermissionToRoleUseCase assignPermissionToRoleUseCase;
    @MockitoBean
    private RolePermissionRepository rolePermissionRepository;

    private Role instructorRole;

    @BeforeEach
    void setUp() {
        instructorRole = new Role();
        instructorRole.setRoleId(1);
        instructorRole.setRoleName("INSTRUCTOR");
        instructorRole.setDescription("Teaches classes");
        instructorRole.setRowVersion(1L);
    }

    @Nested
    @DisplayName("POST /api/v1/roles")
    class CreateTests {

        @Test
        @DisplayName("givenValidRequest_whenCreateRole_thenReturn201WithJson")
        void givenValidRequest_whenCreateRole_thenReturn201WithJson() throws Exception {
            // Arrange
            when(createRoleUseCase.createRole("INSTRUCTOR", "Teaches classes"))
                    .thenReturn(instructorRole);

            // Act & Assert
            mockMvc.perform(post("/api/v1/roles")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"roleName":"INSTRUCTOR","description":"Teaches classes"}"""))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.roleId").value(1))
                    .andExpect(jsonPath("$.roleName").value("INSTRUCTOR"))
                    .andExpect(jsonPath("$.description").value("Teaches classes"))
                    .andExpect(jsonPath("$.rowVersion").value(1));
        }

        @Test
        @DisplayName("givenBlankRoleName_whenCreateRole_thenReturn400FieldError")
        void givenBlankRoleName_whenCreateRole_thenReturn400FieldError() throws Exception {
            // Arrange: CreateRoleRequest.roleName es @NotBlank

            // Act & Assert
            mockMvc.perform(post("/api/v1/roles")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"roleName":"  ","description":"x"}"""))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-002"))
                    .andExpect(jsonPath("$.error.message")
                            .value(org.hamcrest.Matchers.containsString("roleName")));
        }

        @Test
        @DisplayName("givenDuplicatedName_whenCreateRole_thenReturn409Conflict")
        void givenDuplicatedName_whenCreateRole_thenReturn409Conflict() throws Exception {
            // Arrange
            when(createRoleUseCase.createRole("ADMIN", null))
                    .thenThrow(new DuplicateEntityException("Role already exists with name=ADMIN"));

            // Act & Assert
            mockMvc.perform(post("/api/v1/roles")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"roleName\":\"ADMIN\"}"))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-DUP-001"))
                    .andExpect(jsonPath("$.error.severity").value("WARNING"));
        }
    }

    @Nested
    @DisplayName("GET/PUT/DELETE /api/v1/roles/{id}")
    class CrudTests {

        @Test
        @DisplayName("givenExistingId_whenGetRole_thenReturn200Json")
        void givenExistingId_whenGetRole_thenReturn200Json() throws Exception {
            // Arrange
            when(getRoleUseCase.getRole(1)).thenReturn(instructorRole);

            // Act & Assert
            mockMvc.perform(get("/api/v1/roles/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.roleId").value(1))
                    .andExpect(jsonPath("$.roleName").value("INSTRUCTOR"));
        }

        @Test
        @DisplayName("givenMissingId_whenGetRole_thenReturn404IsoEnvelope")
        void givenMissingId_whenGetRole_thenReturn404IsoEnvelope() throws Exception {
            // Arrange
            when(getRoleUseCase.getRole(404)).thenThrow(new EntityNotFoundException("Role", 404));

            // Act & Assert
            mockMvc.perform(get("/api/v1/roles/404"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-INT-001"))
                    .andExpect(jsonPath("$.error.message").value("Role not found with identifier=404"))
                    .andExpect(jsonPath("$.error.correlationId").exists());
        }

        @Test
        @DisplayName("givenExistingId_whenUpdateRole_thenReturn200WithMergedBody")
        void givenExistingId_whenUpdateRole_thenReturn200WithMergedBody() throws Exception {
            // Arrange
            Role updated = new Role();
            updated.setRoleId(1);
            updated.setRoleName("INSTRUCTOR");
            updated.setDescription("Updated description");
            updated.setRowVersion(2L);
            when(updateRoleUseCase.updateRole(1, "INSTRUCTOR", "Updated description")).thenReturn(updated);

            // Act & Assert
            mockMvc.perform(put("/api/v1/roles/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"roleName":"INSTRUCTOR","description":"Updated description"}"""))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.description").value("Updated description"))
                    .andExpect(jsonPath("$.rowVersion").value(2));
        }

        @Test
        @DisplayName("givenExistingId_whenDeleteRole_thenReturn204")
        void givenExistingId_whenDeleteRole_thenReturn204() throws Exception {
            // Act & Assert
            mockMvc.perform(delete("/api/v1/roles/1"))
                    .andExpect(status().isNoContent());

            verify(deleteRoleUseCase).deleteRole(1);
        }

        @Test
        @DisplayName("givenMissingId_whenDeleteRole_thenReturn404AndNeverDeletes")
        void givenMissingId_whenDeleteRole_thenReturn404AndNeverDeletes() throws Exception {
            // Arrange
            org.mockito.Mockito.doThrow(new EntityNotFoundException("Role", 999))
                    .when(deleteRoleUseCase).deleteRole(999);

            // Act & Assert
            mockMvc.perform(delete("/api/v1/roles/999"))
                    .andExpect(status().isNotFound());

            verify(deleteRoleUseCase).deleteRole(999);
        }

        @Test
        @DisplayName("givenRoles_whenListRoles_thenReturn200Array")
        void givenRoles_whenListRoles_thenReturn200Array() throws Exception {
            // Arrange
            when(listRolesUseCase.listRoles()).thenReturn(List.of(instructorRole));

            // Act & Assert
            mockMvc.perform(get("/api/v1/roles"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].roleName").value("INSTRUCTOR"));
        }
    }

    @Nested
    @DisplayName("Permisos del rol: POST/DELETE/GET /api/v1/roles/{roleId}/permissions")
    class RolePermissionsTests {

        @Test
        @DisplayName("givenValidPermission_whenAssignPermission_thenReturn201")
        void givenValidPermission_whenAssignPermission_thenReturn201() throws Exception {
            // Act & Assert
            mockMvc.perform(post("/api/v1/roles/1/permissions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"permissionId\":10}"))
                    .andExpect(status().isCreated());

            verify(assignPermissionToRoleUseCase).assignPermissionToRole(1, 10);
        }

        @Test
        @DisplayName("givenMissingPermissionId_whenAssignPermission_thenReturn400")
        void givenMissingPermissionId_whenAssignPermission_thenReturn400() throws Exception {
            // Arrange: AssignPermissionRequest.permissionId es @NotNull

            // Act & Assert
            mockMvc.perform(post("/api/v1/roles/1/permissions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-002"));
        }

        @Test
        @DisplayName("givenExistingRole_whenGetPermissionsForRole_thenReturn200Array")
        void givenExistingRole_whenGetPermissionsForRole_thenReturn200Array() throws Exception {
            // Arrange: primero valida que el rol existe y luego consulta el PUERTO de salida
            Permission perm = new Permission();
            perm.setPermissionId(10);
            perm.setPermissionName("attendance.record:read");
            when(getRoleUseCase.getRole(1)).thenReturn(instructorRole);
            when(rolePermissionRepository.findPermissionsByRoleId(1)).thenReturn(List.of(perm));

            // Act & Assert
            mockMvc.perform(get("/api/v1/roles/1/permissions"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].permissionName").value("attendance.record:read"));
        }

        @Test
        @DisplayName("givenMissingRole_whenGetPermissionsForRole_thenReturn404AndNeverQueriesPort")
        void givenMissingRole_whenGetPermissionsForRole_thenReturn404AndNeverQueriesPort() throws Exception {
            // Arrange: el controller aborta en getRoleUseCase antes de tocar el repositorio
            when(getRoleUseCase.getRole(999)).thenThrow(new EntityNotFoundException("Role", 999));

            // Act & Assert
            mockMvc.perform(get("/api/v1/roles/999/permissions"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-INT-001"));

            org.mockito.Mockito.verify(rolePermissionRepository, org.mockito.Mockito.never())
                    .findPermissionsByRoleId(999);
        }

        @Test
        @DisplayName("givenAssignedPermission_whenRemovePermission_thenReturn204")
        void givenAssignedPermission_whenRemovePermission_thenReturn204() throws Exception {
            // Act & Assert
            mockMvc.perform(delete("/api/v1/roles/1/permissions/10"))
                    .andExpect(status().isNoContent());

            verify(assignPermissionToRoleUseCase).removePermissionFromRole(1, 10);
        }
    }
}
