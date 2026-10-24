package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.mapper.UserWebMapper;
import com.faceattend_edu.identity_service.adapter.in.web.security.AuthTokenFilter;
import com.faceattend_edu.identity_service.application.port.in.ActivateUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.ChangeUserStatusUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreateUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.GetUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.ListUsersUseCase;
import com.faceattend_edu.identity_service.application.port.in.NotifyUserCredentialsUseCase;
import com.faceattend_edu.identity_service.application.port.in.UpdateUserUseCase;
import com.faceattend_edu.identity_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Cobertura HTTP (MockMvc) de {@code UserController}: alta con Location, listado
 * paginado (PageResponse), lectura, actualización y cambio de estado.
 */
@WebMvcTest(controllers = UserController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({UserWebMapper.class, com.faceattend_edu.identity_service.adapter.in.web.mapper.PersonWebMapper.class})
@DisplayName("UserController HTTP tests (MockMvc)")
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CreateUserUseCase createUserUseCase;
    @MockitoBean
    private GetUserUseCase getUserUseCase;
    @MockitoBean
    private ListUsersUseCase listUsersUseCase;
    @MockitoBean
    private UpdateUserUseCase updateUserUseCase;
    @MockitoBean
    private ChangeUserStatusUseCase changeUserStatusUseCase;
    @MockitoBean
    private ActivateUserUseCase activateUserUseCase;
    @MockitoBean
    private NotifyUserCredentialsUseCase notifyUserCredentialsUseCase;
    @MockitoBean
    private com.faceattend_edu.identity_service.application.port.in.ProvisionUserUseCase provisionUserUseCase;

    private UUID personId;
    private UUID userId;
    private User carolina;

    @BeforeEach
    void setUp() {
        personId = UUID.randomUUID();
        userId = UUID.randomUUID();
        carolina = new User();
        carolina.setUserId(userId);
        Person person = new Person();
        person.setPersonId(personId);
        carolina.setPersonId(person);
        carolina.setUsername("carolina.mendoza");
        carolina.setAuthenticationType("Local");
        carolina.setStatus(true);
        carolina.setCreatedAt(LocalDateTime.of(2026, 3, 1, 8, 0));
    }

    private String createBody(String username, String password) {
        return "{\"personId\":\"" + personId + "\",\"username\":\"" + username
                + "\",\"password\":\"" + password + "\"}";
    }

    @Nested
    @DisplayName("POST /api/v1/users")
    class CreateUserTests {

        @Test
        @DisplayName("givenValidRequest_whenCreateUser_thenReturn201WithLocationAndJson")
        void givenValidRequest_whenCreateUser_thenReturn201WithLocationAndJson() throws Exception {
            // Arrange
            when(createUserUseCase.createUser(any(User.class), eq("Secret123")))
                    .thenReturn(carolina);

            // Act & Assert
            mockMvc.perform(post("/api/v1/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(createBody("carolina.mendoza", "Secret123")))
                    .andExpect(status().isCreated())
                    .andExpect(header().string("Location",
                            org.hamcrest.Matchers.containsString("/api/v1/users/" + userId)))
                    .andExpect(jsonPath("$.userId").value(userId.toString()))
                    .andExpect(jsonPath("$.username").value("carolina.mendoza"))
                    .andExpect(jsonPath("$.status").value(true))
                    // La credencial jamás viaja en la respuesta.
                    .andExpect(jsonPath("$.passwordHash").doesNotExist());

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(createUserUseCase).createUser(captor.capture(), eq("Secret123"));
            assertEquals(personId, captor.getValue().getPersonId().getPersonId());
            assertEquals("carolina.mendoza", captor.getValue().getUsername());
        }

        private String createBodyWithCredentials(String username, String password) {
            return "{\"personId\":\"" + personId + "\",\"username\":\"" + username
                    + "\",\"password\":\"" + password + "\",\"sendCredentials\":true}";
        }

        @Test
        @DisplayName("givenSendCredentials_whenEmailAccepted_thenReportSentAndMustChangePassword")
        void givenSendCredentials_whenEmailAccepted_thenReportSentAndMustChangePassword() throws Exception {
            when(createUserUseCase.createUser(any(User.class), eq("Secret123"))).thenReturn(carolina);
            when(notifyUserCredentialsUseCase.notifyCredentials(userId, "Secret123"))
                    .thenReturn(NotifyUserCredentialsUseCase.Status.SENT);

            mockMvc.perform(post("/api/v1/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(createBodyWithCredentials("carolina.mendoza", "Secret123")))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.credentialsEmail").value("SENT"))
                    .andExpect(jsonPath("$.mustChangePassword").value(true))
                    .andExpect(jsonPath("$.password").doesNotExist());
        }

        @Test
        @DisplayName("givenSendCredentials_whenEmailFails_thenStillCreateAndReportFailed")
        void givenSendCredentials_whenEmailFails_thenStillCreateAndReportFailed() throws Exception {
            when(createUserUseCase.createUser(any(User.class), eq("Secret123"))).thenReturn(carolina);
            when(notifyUserCredentialsUseCase.notifyCredentials(userId, "Secret123"))
                    .thenReturn(NotifyUserCredentialsUseCase.Status.FAILED);

            mockMvc.perform(post("/api/v1/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(createBodyWithCredentials("carolina.mendoza", "Secret123")))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.credentialsEmail").value("FAILED"))
                    .andExpect(jsonPath("$.mustChangePassword").value(false));
        }

        @Test
        @DisplayName("givenNoSendCredentials_whenCreateUser_thenNeverNotify")
        void givenNoSendCredentials_whenCreateUser_thenNeverNotify() throws Exception {
            when(createUserUseCase.createUser(any(User.class), eq("Secret123"))).thenReturn(carolina);

            mockMvc.perform(post("/api/v1/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(createBody("carolina.mendoza", "Secret123")))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.credentialsEmail").doesNotExist());

            org.mockito.Mockito.verifyNoInteractions(notifyUserCredentialsUseCase);
        }

        @Test
        @DisplayName("givenShortPassword_whenCreateUser_thenReturn400ValidationError")
        void givenShortPassword_whenCreateUser_thenReturn400ValidationError() throws Exception {
            // Arrange: CreateUserRequest.password exige entre 8 y 100 caracteres

            // Act & Assert
            mockMvc.perform(post("/api/v1/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(createBody("carolina.mendoza", "Secret1")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("password")));
        }

        @Test
        @DisplayName("givenUnknownPerson_whenCreateUser_thenReturn404NotFound")
        void givenUnknownPerson_whenCreateUser_thenReturn404NotFound() throws Exception {
            // Arrange
            when(createUserUseCase.createUser(any(User.class), eq("Secret123")))
                    .thenThrow(new EntityNotFoundException("Person", personId));

            // Act & Assert
            mockMvc.perform(post("/api/v1/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(createBody("carolina.mendoza", "Secret123")))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("NOT_FOUND"))
                    .andExpect(jsonPath("$.message").value(
                            "Person not found with identifier=" + personId));
        }

        @Test
        @DisplayName("givenDuplicatedUsername_whenCreateUser_thenReturn409Conflict")
        void givenDuplicatedUsername_whenCreateUser_thenReturn409Conflict() throws Exception {
            // Arrange
            when(createUserUseCase.createUser(any(User.class), eq("Secret123")))
                    .thenThrow(new DuplicateEntityException("User", "carolina.mendoza"));

            // Act & Assert
            mockMvc.perform(post("/api/v1/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(createBody("carolina.mendoza", "Secret123")))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error").value("CONFLICT"))
                    .andExpect(jsonPath("$.message").value(
                            "User already exists with value=carolina.mendoza"));
        }
    }

    @Nested
    @DisplayName("GET / PUT / POST / PATCH /api/v1/users")
    class CrudTests {

        @Test
        @DisplayName("givenUsers_whenListUsers_thenReturn200PaginatedEnvelope")
        void givenUsers_whenListUsers_thenReturn200PaginatedEnvelope() throws Exception {
            // Arrange: PageResponse usa page base 1 -> el caso de uso recibe índice 0
            when(listUsersUseCase.listUsers(0, 20)).thenReturn(List.of(carolina));
            when(listUsersUseCase.countUsers()).thenReturn(42L);

            // Act & Assert
            mockMvc.perform(get("/api/v1/users"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data[0].username").value("carolina.mendoza"))
                    .andExpect(jsonPath("$.data[0].userId").value(userId.toString()))
                    .andExpect(jsonPath("$.meta.page").value(1))
                    .andExpect(jsonPath("$.meta.limit").value(20))
                    .andExpect(jsonPath("$.meta.total").value(42))
                    .andExpect(jsonPath("$.meta.totalPages").value(3));
        }

        @Test
        @DisplayName("givenSchoolScope_whenListUsers_thenReturnOnlyScopedAccounts")
        void givenSchoolScope_whenListUsers_thenReturnOnlyScopedAccounts() throws Exception {
            // Arrange: el filtro ya resolvió el alcance de la sede del Administrador
            Set<UUID> scope = Set.of(personId);
            when(listUsersUseCase.listUsers(0, 20, scope)).thenReturn(List.of(carolina));
            when(listUsersUseCase.countUsers(scope)).thenReturn(1L);

            // Act & Assert
            mockMvc.perform(get("/api/v1/users")
                            .requestAttr(AuthTokenFilter.PERSON_SCOPE_ATTRIBUTE, scope))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data[0].username").value("carolina.mendoza"))
                    .andExpect(jsonPath("$.meta.total").value(1))
                    .andExpect(jsonPath("$.meta.totalPages").value(1));

            verify(listUsersUseCase).listUsers(0, 20, scope);
        }

        @Test
        @DisplayName("givenExistingId_whenGetUser_thenReturn200Json")
        void givenExistingId_whenGetUser_thenReturn200Json() throws Exception {
            // Arrange
            when(getUserUseCase.getUser(userId)).thenReturn(carolina);

            // Act & Assert
            mockMvc.perform(get("/api/v1/users/" + userId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.userId").value(userId.toString()))
                    .andExpect(jsonPath("$.username").value("carolina.mendoza"));
        }

        @Test
        @DisplayName("givenMissingId_whenGetUser_thenReturn404NotFound")
        void givenMissingId_whenGetUser_thenReturn404NotFound() throws Exception {
            // Arrange
            UUID missing = UUID.randomUUID();
            when(getUserUseCase.getUser(missing))
                    .thenThrow(new EntityNotFoundException("User", missing));

            // Act & Assert
            mockMvc.perform(get("/api/v1/users/" + missing))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("NOT_FOUND"));
        }

        @Test
        @DisplayName("givenExistingId_whenUpdateUser_thenReturn204AndPersistsPathId")
        void givenExistingId_whenUpdateUser_thenReturn204AndPersistsPathId() throws Exception {
            // Act & Assert
            mockMvc.perform(put("/api/v1/users/" + userId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"personId":"%s","username":"carolina.mendoza","authenticationType":"Local","status":true}"""
                                    .formatted(personId)))
                    .andExpect(status().isNoContent());

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(updateUserUseCase).updateUser(captor.capture());
            // El id de la ruta manda sobre el del cuerpo.
            assertEquals(userId, captor.getValue().getUserId());
            assertEquals("carolina.mendoza", captor.getValue().getUsername());
        }

        @Test
        @DisplayName("givenExistingId_whenActivateUser_thenReturn204")
        void givenExistingId_whenActivateUser_thenReturn204() throws Exception {
            // Act & Assert
            mockMvc.perform(post("/api/v1/users/" + userId + "/activate"))
                    .andExpect(status().isNoContent());

            verify(activateUserUseCase).activateUser(userId);
        }

        @Test
        @DisplayName("givenStatusParam_whenChangeStatus_thenReturn204")
        void givenStatusParam_whenChangeStatus_thenReturn204() throws Exception {
            // Act & Assert
            mockMvc.perform(patch("/api/v1/users/" + userId + "/status")
                            .param("status", "false"))
                    .andExpect(status().isNoContent());

            verify(changeUserStatusUseCase).changeStatus(userId, false);
        }
    }

    @org.junit.jupiter.api.Nested
    @org.junit.jupiter.api.DisplayName("POST /api/v1/users/provision")
    class ProvisionTests {

        private static final String BODY = """
                {"person":{"documentNumber":"1001","name":"Ana","lastName":"Rios","email":"ana@sede.edu.co"},
                 "username":"ana.rios","password":"Temporal-2026","sendCredentials":false,"roleName":"Aprendiz",
                 "academicActor":{"actorTypeId":1,"schoolId":4,"actorCode":"APR-1001","cohortId":9}}""";

        @org.junit.jupiter.api.Test
        void provisionsWithTheCallerSessionAndAnswers201() throws Exception {
            UUID newPerson = UUID.randomUUID();
            UUID newUser = UUID.randomUUID();
            org.mockito.Mockito.when(provisionUserUseCase.provision(org.mockito.ArgumentMatchers.any(),
                            org.mockito.ArgumentMatchers.eq("11111111-2222-3333-4444-555555555555")))
                    .thenReturn(new com.faceattend_edu.identity_service.application.port.in.ProvisionUserUseCase.Result(
                            newPerson, newUser, "ana.rios", 30L, 40L, null));

            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/users/provision")
                            .header("Authorization", "Bearer 11111111-2222-3333-4444-555555555555")
                            .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                            .content(BODY))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated())
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.userId").value(newUser.toString()))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.enrollmentId").value(40));
        }

        @org.junit.jupiter.api.Test
        void aMissingPersonIsRejectedBeforeAnyCall() throws Exception {
            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/users/provision")
                            .header("Authorization", "Bearer 11111111-2222-3333-4444-555555555555")
                            .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"x\",\"password\":\"Temporal-2026\",\"roleName\":\"Aprendiz\"}"))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
            org.mockito.Mockito.verifyNoInteractions(provisionUserUseCase);
        }
    }
}
