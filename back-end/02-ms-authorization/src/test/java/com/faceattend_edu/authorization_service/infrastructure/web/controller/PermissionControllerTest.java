package com.faceattend_edu.authorization_service.infrastructure.web.controller;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.port.in.CreatePermissionUseCase;
import com.faceattend_edu.authorization_service.domain.port.in.DeletePermissionUseCase;
import com.faceattend_edu.authorization_service.domain.port.in.GetPermissionUseCase;
import com.faceattend_edu.authorization_service.domain.port.in.ListPermissionsUseCase;
import com.faceattend_edu.authorization_service.domain.port.in.UpdatePermissionUseCase;
import com.faceattend_edu.authorization_service.infrastructure.web.mapper.PermissionWebMapper;
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

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Test de integracion de capa web (Spring MVC slice) para {@code PermissionController}.
 *
 * <p><b>Stack detectado en el pom.xml:</b> Spring Boot 4.1.1, por lo que se usa
 * {@code @MockitoBean} (Spring Framework 7) en lugar del deprecado {@code @MockBean}
 * de Boot {@code < 3.4}.</p>
 *
 * <p><b>Aislamiento:</b> {@code @WebMvcTest} solo carga controllers, {@code @ControllerAdvice}
 * (el {@code GlobalExceptionHandler} real) y validacion; los casos de uso se mockean con
 * {@code @MockitoBean} y el mapper se importa tal cual porque es una clase de estado puro
 * (asi el JSON de respuesta refleja el mapeo real en lugar de un stub).</p>
 *
 * <p><b>Seguridad:</b> {@code @AutoConfigureMockMvc(addFilters = false)} desactiva los filtros
 * registrados en el contexto — en este proyecto {@code AuthTokenFilter} (y la cadena de
 * seguridad por defecto) devolveria 401/403 antes de llegar al controller y haria llamadas
 * HTTP reales a los servicios identity/authorization. La seguridad se prueba aparte.</p>
 */
@WebMvcTest(controllers = PermissionController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(PermissionWebMapper.class)
@DisplayName("IEEE 829 TC-02-007: PermissionController REST tests (MockMvc)")
class PermissionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CreatePermissionUseCase createPermissionUseCase;
    @MockitoBean
    private UpdatePermissionUseCase updatePermissionUseCase;
    @MockitoBean
    private GetPermissionUseCase getPermissionUseCase;
    @MockitoBean
    private ListPermissionsUseCase listPermissionsUseCase;
    @MockitoBean
    private DeletePermissionUseCase deletePermissionUseCase;

    private Permission savedPermission;

    @BeforeEach
    void setUp() {
        savedPermission = new Permission();
        savedPermission.setPermissionId(10);
        savedPermission.setPermissionName("attendance.record:read");
        savedPermission.setDescription("Read attendance records");
        savedPermission.setCreatedAt(Instant.parse("2026-01-15T10:15:30Z"));
        savedPermission.setRowVersion(1L);
    }

    @Nested
    @DisplayName("POST /api/v1/permissions")
    class CreateTests {

        @Test
        @DisplayName("givenValidRequest_whenCreatePermission_thenReturn201WithBody")
        void givenValidRequest_whenCreatePermission_thenReturn201WithBody() throws Exception {
            // Arrange
            when(createPermissionUseCase.createPermission("attendance.record:read", "Read attendance records"))
                    .thenReturn(savedPermission);

            // Act & Assert
            mockMvc.perform(post("/api/v1/permissions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"permissionName":"attendance.record:read",
                                     "description":"Read attendance records"}"""))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.permissionId").value(10))
                    .andExpect(jsonPath("$.permissionName").value("attendance.record:read"))
                    .andExpect(jsonPath("$.description").value("Read attendance records"))
                    .andExpect(jsonPath("$.rowVersion").value(1))
                    .andExpect(jsonPath("$.createdAt").exists());

            // Verify la interaccion: el caso de uso recibe exactamente los campos del DTO
            verify(createPermissionUseCase)
                    .createPermission("attendance.record:read", "Read attendance records");
        }

        @Test
        @DisplayName("givenBlankPermissionName_whenCreatePermission_thenReturn400AndNeverCallsUseCase")
        void givenBlankPermissionName_whenCreatePermission_thenReturn400AndNeverCallsUseCase() throws Exception {
            // Arrange: la validacion @NotBlank del DTO corta antes de llegar al caso de uso

            // Act & Assert
            mockMvc.perform(post("/api/v1/permissions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"permissionName":"   ","description":"ignored"}"""))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-002"))
                    .andExpect(jsonPath("$.error.message").value(org.hamcrest.Matchers.containsString("permissionName")))
                    .andExpect(jsonPath("$.error.severity").value("WARNING"));

            verify(createPermissionUseCase, never()).createPermission(anyString(), any());
        }

        @Test
        @DisplayName("givenDuplicateName_whenCreatePermission_thenReturn409Conflict")
        void givenDuplicateName_whenCreatePermission_thenReturn409Conflict() throws Exception {
            // Arrange: el caso de uso lanza la excepcion de negocio real del codigo
            when(createPermissionUseCase.createPermission("attendance.record:read", "dup"))
                    .thenThrow(new DuplicateEntityException("Permission already exists with name=attendance.record:read"));

            // Act & Assert
            mockMvc.perform(post("/api/v1/permissions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"permissionName":"attendance.record:read","description":"dup"}"""))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-DUP-001"))
                    .andExpect(jsonPath("$.error.message")
                            .value(org.hamcrest.Matchers.containsString("already exists")))
                    .andExpect(jsonPath("$.error.isoClause").value("8.5"));
        }

        @Test
        @DisplayName("givenMalformedJson_whenCreatePermission_thenReturn400MalformedBody")
        void givenMalformedJson_whenCreatePermission_thenReturn400MalformedBody() throws Exception {
            // Act & Assert
            mockMvc.perform(post("/api/v1/permissions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{not-a-json"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-002"))
                    .andExpect(jsonPath("$.error.message").value("Malformed request body"));
        }
    }

    @Nested
    @DisplayName("GET /api/v1/permissions/{id}")
    class GetTests {

        @Test
        @DisplayName("givenExistingId_whenGetPermission_thenReturn200WithBody")
        void givenExistingId_whenGetPermission_thenReturn200WithBody() throws Exception {
            // Arrange
            when(getPermissionUseCase.getPermission(10)).thenReturn(savedPermission);

            // Act & Assert
            mockMvc.perform(get("/api/v1/permissions/10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.permissionId").value(10))
                    .andExpect(jsonPath("$.permissionName").value("attendance.record:read"));
        }

        @Test
        @DisplayName("givenMissingId_whenGetPermission_thenReturn404IsoEnvelope")
        void givenMissingId_whenGetPermission_thenReturn404IsoEnvelope() throws Exception {
            // Arrange: excepcion de negocio real, manejada por el GlobalExceptionHandler real
            when(getPermissionUseCase.getPermission(999))
                    .thenThrow(new EntityNotFoundException("Permission", 999));

            // Act & Assert
            mockMvc.perform(get("/api/v1/permissions/999"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-INT-001"))
                    .andExpect(jsonPath("$.error.message").value("Permission not found with identifier=999"))
                    .andExpect(jsonPath("$.error.isoClause").value("8.5"))
                    .andExpect(jsonPath("$.error.correlationId").exists());
        }

        @Test
        @DisplayName("givenNonNumericId_whenGetPermission_thenReturn400TypeMismatch")
        void givenNonNumericId_whenGetPermission_thenReturn400TypeMismatch() throws Exception {
            // Act & Assert: el id es Integer, "abc" no convierte
            mockMvc.perform(get("/api/v1/permissions/abc"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-002"))
                    .andExpect(jsonPath("$.error.message").value("Invalid value for parameter 'id'"));
        }
    }

    @Nested
    @DisplayName("PUT /api/v1/permissions/{id}")
    class UpdateTests {

        @Test
        @DisplayName("givenExistingId_whenUpdatePermission_thenReturn200WithUpdatedBody")
        void givenExistingId_whenUpdatePermission_thenReturn200WithUpdatedBody() throws Exception {
            // Arrange
            Permission updated = new Permission();
            updated.setPermissionId(10);
            updated.setPermissionName("attendance.record:write");
            updated.setDescription("Updated");
            updated.setRowVersion(2L);
            when(updatePermissionUseCase.updatePermission(10, "attendance.record:write", "Updated"))
                    .thenReturn(updated);

            // Act & Assert
            mockMvc.perform(put("/api/v1/permissions/10")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"permissionName":"attendance.record:write","description":"Updated"}"""))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.permissionName").value("attendance.record:write"))
                    .andExpect(jsonPath("$.rowVersion").value(2));

            verify(updatePermissionUseCase).updatePermission(10, "attendance.record:write", "Updated");
        }

        @Test
        @DisplayName("givenMissingId_whenUpdatePermission_thenReturn404")
        void givenMissingId_whenUpdatePermission_thenReturn404() throws Exception {
            // Arrange
            when(updatePermissionUseCase.updatePermission(999, "x", "y"))
                    .thenThrow(new EntityNotFoundException("Permission", 999));

            // Act & Assert
            mockMvc.perform(put("/api/v1/permissions/999")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"permissionName":"x","description":"y"}"""))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-INT-001"));
        }
    }

    @Nested
    @DisplayName("DELETE /api/v1/permissions/{id}")
    class DeleteTests {

        @Test
        @DisplayName("givenExistingId_whenDeletePermission_thenReturn204AndVerifyInteraction")
        void givenExistingId_whenDeletePermission_thenReturn204AndVerifyInteraction() throws Exception {
            // Act & Assert
            mockMvc.perform(delete("/api/v1/permissions/10"))
                    .andExpect(status().isNoContent());

            verify(deletePermissionUseCase).deletePermission(10);
        }

        @Test
        @DisplayName("givenMissingId_whenDeletePermission_thenReturn404AndNeverDeletes")
        void givenMissingId_whenDeletePermission_thenReturn404AndNeverDeletes() throws Exception {
            // Arrange
            org.mockito.Mockito.doThrow(new EntityNotFoundException("Permission", 999))
                    .when(deletePermissionUseCase).deletePermission(999);

            // Act & Assert
            mockMvc.perform(delete("/api/v1/permissions/999"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-INT-001"));
        }
    }

    @Nested
    @DisplayName("GET /api/v1/permissions (list y alias sin prefijo)")
    class ListTests {

        @Test
        @DisplayName("givenPermissions_whenListPermissions_thenReturn200Array")
        void givenPermissions_whenListPermissions_thenReturn200Array() throws Exception {
            // Arrange
            Permission other = new Permission();
            other.setPermissionId(11);
            other.setPermissionName("attendance.justification:approve");
            when(listPermissionsUseCase.listPermissions()).thenReturn(List.of(savedPermission, other));

            // Act & Assert
            mockMvc.perform(get("/api/v1/permissions"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].permissionName").value("attendance.record:read"))
                    .andExpect(jsonPath("$[1].permissionName").value("attendance.justification:approve"));
        }

        @Test
        @DisplayName("givenAliasRoute_whenGetPermission_thenReturn200")
        void givenAliasRoute_whenGetPermission_thenReturn200() throws Exception {
            // Arrange: el controller declara rutas dobles {"/api/v1/permissions", "/permissions"}
            when(getPermissionUseCase.getPermission(10)).thenReturn(savedPermission);

            // Act & Assert
            mockMvc.perform(get("/permissions/10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.permissionId").value(10));
        }

        @Test
        @DisplayName("givenEmptyList_whenListPermissions_thenReturn200EmptyArray")
        void givenEmptyList_whenListPermissions_thenReturn200EmptyArray() throws Exception {
            // Arrange
            when(listPermissionsUseCase.listPermissions()).thenReturn(List.of());

            // Act & Assert
            mockMvc.perform(get("/api/v1/permissions"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(0));
        }
    }
}
