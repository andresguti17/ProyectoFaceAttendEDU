package com.faceattend_edu.authorization_service.infrastructure.web.controller;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.port.in.AssignRoleToUserUseCase;
import com.faceattend_edu.authorization_service.domain.port.in.CheckPermissionUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
import com.faceattend_edu.authorization_service.domain.port.out.UserRoleRepository;
import com.faceattend_edu.authorization_service.infrastructure.web.mapper.RoleWebMapper;
import com.faceattend_edu.shared.auth.UserSchools;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests de la capa web (Spring MVC slice) para {@code UserRoleController}.
 *
 * <p>Este controller NO tenia ninguna prueba: expone el RBAC hacia fuera
 * (asignar/quitar roles, consultar roles de un usuario, batch de usuarios y
 * el endpoint {@code /auth/evaluate} que consume el AuthTokenFilter de los demas servicios).</p>
 *
 * <p>Receta Boot 4.1.1: {@code @MockitoBean} (no el deprecado {@code @MockBean}) +
 * {@code @AutoConfigureMockMvc(addFilters = false)} para que el {@code AuthTokenFilter}
 * del contexto no intercepte las peticiones con 401 ni haga llamadas HTTP reales.</p>
 */
@WebMvcTest(controllers = UserRoleController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(RoleWebMapper.class)
@DisplayName("IEEE 829 TC-02-008: UserRoleController REST tests (MockMvc)")
class UserRoleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AssignRoleToUserUseCase assignRoleToUserUseCase;
    @MockitoBean
    private CheckPermissionUseCase checkPermissionUseCase;
    @MockitoBean
    private RoleRepository roleRepository;
    @MockitoBean
    private UserRoleRepository userRoleRepository;
    @MockitoBean
    private UserSchools userSchools;

    private static final String ADMIN = "aaaaaaaa-0000-4000-8000-000000000002";
    private static final String TOKEN = "22222222-2222-4222-8222-222222222222";

    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = UUID.fromString("11111111-2222-3333-4444-555555555555");
    }

    private Role role(int id, String name) {
        Role r = new Role();
        r.setRoleId(id);
        r.setRoleName(name);
        r.setDescription("desc " + name);
        r.setRowVersion(1L);
        return r;
    }

    @Nested
    @DisplayName("POST /api/v1/users/{userId}/roles")
    class AssignTests {

        @Test
        @DisplayName("givenValidRole_whenAssignRole_thenReturn201AndVerifyUseCase")
        void givenValidRole_whenAssignRole_thenReturn201AndVerifyUseCase() throws Exception {
            // Act & Assert
            mockMvc.perform(post("/api/v1/users/" + userId + "/roles")
                            .requestAttr("X-User-Roles", List.of("Super Administrador"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"roleId\":3}"))
                    .andExpect(status().isCreated());

            verify(assignRoleToUserUseCase).assignRoleToUser(userId, 3);
        }

        @Test
        @DisplayName("givenOperationalRole_whenSchoolAdminOfTheSameSchool_thenAllowed")
        void givenOperationalRole_whenSchoolAdmin_thenAllowed() throws Exception {
            when(roleRepository.findById(3)).thenReturn(java.util.Optional.of(role(3, "Aprendiz")));
            when(userSchools.of(ADMIN, TOKEN)).thenReturn(Set.of(7));
            when(userSchools.of(userId.toString(), TOKEN)).thenReturn(Set.of(7));

            mockMvc.perform(post("/api/v1/users/" + userId + "/roles")
                            .requestAttr("X-User-Roles", List.of("Administrador"))
                            .requestAttr("X-User-Id", ADMIN)
                            .header("Authorization", "Bearer " + TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"roleId\":3}"))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("givenOperationalRole_whenTargetIsInAnotherSchool_thenForbidden")
        void givenOperationalRole_whenTargetIsInAnotherSchool_thenForbidden() throws Exception {
            when(roleRepository.findById(3)).thenReturn(java.util.Optional.of(role(3, "Instructor")));
            when(userSchools.of(ADMIN, TOKEN)).thenReturn(Set.of(7));
            when(userSchools.of(userId.toString(), TOKEN)).thenReturn(Set.of());

            mockMvc.perform(post("/api/v1/users/" + userId + "/roles")
                            .requestAttr("X-User-Roles", List.of("Administrador"))
                            .requestAttr("X-User-Id", ADMIN)
                            .header("Authorization", "Bearer " + TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"roleId\":3}"))
                    .andExpect(status().isForbidden());
            mockMvc.perform(delete("/api/v1/users/" + userId + "/roles/3")
                            .requestAttr("X-User-Roles", List.of("Administrador"))
                            .requestAttr("X-User-Id", ADMIN)
                            .header("Authorization", "Bearer " + TOKEN))
                    .andExpect(status().isForbidden());

            verify(assignRoleToUserUseCase, never()).assignRoleToUser(any(), any());
            verify(assignRoleToUserUseCase, never()).removeRoleFromUser(any(), any());
        }

        @Test
        @DisplayName("givenOperationalRole_whenCallerHasNoSchool_thenForbidden")
        void givenOperationalRole_whenCallerHasNoSchool_thenForbidden() throws Exception {
            when(roleRepository.findById(3)).thenReturn(java.util.Optional.of(role(3, "Aprendiz")));
            when(userSchools.of(any(), any())).thenReturn(Set.of());

            mockMvc.perform(post("/api/v1/users/" + userId + "/roles")
                            .requestAttr("X-User-Roles", List.of("Administrador"))
                            .requestAttr("X-User-Id", ADMIN)
                            .header("Authorization", "Bearer " + TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"roleId\":3}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("givenAdministradorRole_whenSchoolAdmin_thenForbidden")
        void givenAdministradorRole_whenSchoolAdmin_thenForbidden() throws Exception {
            when(roleRepository.findById(2)).thenReturn(java.util.Optional.of(role(2, "Administrador")));

            mockMvc.perform(post("/api/v1/users/" + userId + "/roles")
                            .requestAttr("X-User-Roles", List.of("Administrador"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"roleId\":2}"))
                    .andExpect(status().isForbidden());

            verify(assignRoleToUserUseCase, never()).assignRoleToUser(any(), any());
        }

        private Role role(int id, String name) {
            Role r = new Role();
            r.setRoleId(id);
            r.setRoleName(name);
            return r;
        }

        @Test
        @DisplayName("givenMissingRoleId_whenAssignRole_thenReturn400AndNeverCallsUseCase")
        void givenMissingRoleId_whenAssignRole_thenReturn400AndNeverCallsUseCase() throws Exception {
            // Arrange: AssignRoleRequest.roleId es @NotNull

            // Act & Assert
            mockMvc.perform(post("/api/v1/users/" + userId + "/roles")
                            .requestAttr("X-User-Roles", List.of("Super Administrador"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-002"))
                    .andExpect(jsonPath("$.error.message").value(org.hamcrest.Matchers.containsString("roleId")));

            verify(assignRoleToUserUseCase, never()).assignRoleToUser(any(), any());
        }

        @Test
        @DisplayName("givenUnknownRole_whenAssignRole_thenReturn404")
        void givenUnknownRole_whenAssignRole_thenReturn404() throws Exception {
            // Arrange: la excepcion de negocio real propagada por el caso de uso
            org.mockito.Mockito.doThrow(new EntityNotFoundException("Role", 999))
                    .when(assignRoleToUserUseCase).assignRoleToUser(userId, 999);

            // Act & Assert
            mockMvc.perform(post("/api/v1/users/" + userId + "/roles")
                            .requestAttr("X-User-Roles", List.of("Super Administrador"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"roleId\":999}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-INT-001"));
        }

        @Test
        @DisplayName("givenAlreadyAssignedRole_whenAssignRole_thenReturn409")
        void givenAlreadyAssignedRole_whenAssignRole_thenReturn409() throws Exception {
            // Arrange
            org.mockito.Mockito.doThrow(new DuplicateEntityException("Role already assigned to user"))
                    .when(assignRoleToUserUseCase).assignRoleToUser(userId, 3);

            // Act & Assert
            mockMvc.perform(post("/api/v1/users/" + userId + "/roles")
                            .requestAttr("X-User-Roles", List.of("Super Administrador"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"roleId\":3}"))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-DUP-001"));
        }
    }

    @Nested
    @DisplayName("DELETE /api/v1/users/{userId}/roles/{roleId}")
    class RemoveTests {

        @Test
        @DisplayName("givenAssignedRole_whenRemoveRole_thenReturn204")
        void givenAssignedRole_whenRemoveRole_thenReturn204() throws Exception {
            // Act & Assert
            mockMvc.perform(delete("/api/v1/users/" + userId + "/roles/3")
                            .requestAttr("X-User-Roles", List.of("Super Administrador")))
                    .andExpect(status().isNoContent());

            verify(assignRoleToUserUseCase).removeRoleFromUser(userId, 3);
        }

        @Test
        @DisplayName("givenMissingAssignment_whenRemoveRole_thenReturn404")
        void givenMissingAssignment_whenRemoveRole_thenReturn404() throws Exception {
            // Arrange
            org.mockito.Mockito.doThrow(new EntityNotFoundException("UserRole", userId + "-3"))
                    .when(assignRoleToUserUseCase).removeRoleFromUser(userId, 3);

            // Act & Assert
            mockMvc.perform(delete("/api/v1/users/" + userId + "/roles/3")
                            .requestAttr("X-User-Roles", List.of("Super Administrador")))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("givenNonUuidPath_whenRemoveRole_thenReturn400TypeMismatch")
        void givenNonUuidPath_whenRemoveRole_thenReturn400TypeMismatch() throws Exception {
            // Act & Assert: el path variable es UUID
            mockMvc.perform(delete("/api/v1/users/not-a-uuid/roles/3"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-002"));
        }
    }

    @Nested
    @DisplayName("GET /api/v1/users/{userId}/roles")
    class GetRolesTests {

        @Test
        @DisplayName("givenUserWithRoles_whenGetRoles_thenReturn200Array")
        void givenUserWithRoles_whenGetRoles_thenReturn200Array() throws Exception {
            // Arrange
            when(userRoleRepository.findRolesByUserId(userId))
                    .thenReturn(List.of(role(1, "SCHOOL_ADMIN"), role(4, "STUDENT")));

            // Act & Assert
            mockMvc.perform(get("/api/v1/users/" + userId + "/roles"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].roleName").value("SCHOOL_ADMIN"))
                    .andExpect(jsonPath("$[1].roleName").value("STUDENT"));
        }

        @Test
        @DisplayName("givenUserWithoutRoles_whenGetRoles_thenReturn200EmptyArray")
        void givenUserWithoutRoles_whenGetRoles_thenReturn200EmptyArray() throws Exception {
            // Arrange
            when(userRoleRepository.findRolesByUserId(userId)).thenReturn(List.of());

            // Act & Assert
            mockMvc.perform(get("/api/v1/users/" + userId + "/roles"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(0));
        }
    }

    @Nested
    @DisplayName("GET /api/v1/user-roles?userIds=... (batch)")
    class BatchTests {

        @Test
        @DisplayName("givenNoIds_whenGetRolesForUsers_thenReturn200EmptyMap")
        void givenNoIds_whenGetRolesForUsers_thenReturn200EmptyMap() throws Exception {
            // Act & Assert: sin parametros el controller devuelve Map.of() sin consultar
            mockMvc.perform(get("/api/v1/user-roles"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(0));

            verify(userRoleRepository, never()).findRolesByUserIds(anyCollection());
        }

        @Test
        @DisplayName("givenTwoIds_whenGetRolesForUsers_thenReturn200MapKeyedByUser")
        void givenTwoIds_whenGetRolesForUsers_thenReturn200MapKeyedByUser() throws Exception {
            // Arrange
            UUID second = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
            Map<UUID, List<Role>> found = new LinkedHashMap<>();
            found.put(userId, List.of(role(1, "SCHOOL_ADMIN")));
            found.put(second, List.of());
            when(userRoleRepository.findRolesByUserIds(anyCollection())).thenReturn(found);

            // Act & Assert: las claves del mapa son los UUID en texto
            mockMvc.perform(get("/api/v1/user-roles")
                            .param("userIds", userId.toString(), second.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$." + userId + "[0].roleName").value("SCHOOL_ADMIN"));
        }

        @Test
        @DisplayName("givenMoreThan300Ids_whenGetRolesForUsers_thenReturn400")
        void givenMoreThan300Ids_whenGetRolesForUsers_thenReturn400() throws Exception {
            // Arrange: el limite del controller es 300 ids por peticion (MAX_BATCH_USERS)
            String[] ids = IntStream.range(0, 301)
                    .mapToObj(i -> UUID.randomUUID().toString())
                    .toArray(String[]::new);

            // Act & Assert
            mockMvc.perform(get("/api/v1/user-roles").param("userIds", ids))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-001"))
                    .andExpect(jsonPath("$.error.message")
                            .value(org.hamcrest.Matchers.containsString("at most 300")));

            verify(userRoleRepository, never()).findRolesByUserIds(anyCollection());
        }
    }

    @Nested
    @DisplayName("GET /api/v1/auth/evaluate")
    class EvaluateTests {

        @Test
        @DisplayName("givenPermissionGranted_whenEvaluate_thenReturn200AllowedTrue")
        void givenPermissionGranted_whenEvaluate_thenReturn200AllowedTrue() throws Exception {
            // Arrange
            when(checkPermissionUseCase.hasPermission(userId, "attendance.record:read")).thenReturn(true);

            // Act & Assert
            mockMvc.perform(get("/api/v1/auth/evaluate")
                            .param("userId", userId.toString())
                            .param("permission", "attendance.record:read"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.userId").value(userId.toString()))
                    .andExpect(jsonPath("$.permission").value("attendance.record:read"))
                    .andExpect(jsonPath("$.allowed").value(true));
        }

        @Test
        @DisplayName("givenPermissionDenied_whenEvaluate_thenReturn200AllowedFalse")
        void givenPermissionDenied_whenEvaluate_thenReturn200AllowedFalse() throws Exception {
            // Arrange
            when(checkPermissionUseCase.hasPermission(userId, "scheduling.session:manage")).thenReturn(false);

            // Act & Assert
            mockMvc.perform(get("/api/v1/auth/evaluate")
                            .param("userId", userId.toString())
                            .param("permission", "scheduling.session:manage"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.allowed").value(false));
        }

        @Test
        @DisplayName("givenMissingUserIdParam_whenEvaluate_thenReturn500ByTheGenericHandler")
        void givenMissingUserIdParam_whenEvaluate_thenReturn500ByTheGenericHandler() throws Exception {
            // Arrange: BRECHA CONOCIDA — MissingServletRequestParameterException no tiene
            // handler propio en GlobalExceptionHandler, asi que cae en el catch-all Exception
            // y responde 500 ISO-10.2-NC-001 en lugar de 400. Se documenta el comportamiento
            // REAL: si alguien anade un @ExceptionHandler para ese caso, este test debera ajustarse.
            mockMvc.perform(get("/api/v1/auth/evaluate")
                            .param("permission", "x"))
                    .andExpect(status().isInternalServerError())
                    .andExpect(jsonPath("$.error.code").value("ISO-10.2-NC-001"));
        }
    }
}
