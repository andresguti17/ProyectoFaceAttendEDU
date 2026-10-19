package com.faceattend_edu.scheduling_service.infrastructure.web.controller;

import com.faceattend_edu.scheduling_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.domain.port.in.CreateEnvironmentUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.DeleteEnvironmentUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.GetEnvironmentUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.ListEnvironmentsUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.UpdateEnvironmentUseCase;
import com.faceattend_edu.scheduling_service.infrastructure.web.mapper.EnvironmentWebMapper;
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

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
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
 * Cobertura HTTP (MockMvc) de {@code EnvironmentController}.
 *
 * <p>Complementa los tests unitarios existentes del modulo: aqui se valida lo que solo
 * se ve por HTTP — rutas duales ({@code /api/v1/environments} y {@code /environments}),
 * serializacion JSON real con el {@code EnvironmentWebMapper} de verdad, validacion
 * {@code @Valid} del DTO y los mapeos de error planos ({@code {"error":"..."}}) del
 * {@code GlobalExceptionHandler} de este servicio.</p>
 *
 * <p>{@code addFilters=false} es obligatorio: sin el, {@code AuthTokenFilter}/{@code AppConfig}
 * devolverian 401 o intentarian una llamada HTTP real a :8081/:8082.</p>
 */
@WebMvcTest(controllers = EnvironmentController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(EnvironmentWebMapper.class)
@DisplayName("IEEE 829 TC-04-001: EnvironmentController HTTP tests (MockMvc)")
class EnvironmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CreateEnvironmentUseCase createUseCase;
    @MockitoBean
    private UpdateEnvironmentUseCase updateUseCase;
    @MockitoBean
    private GetEnvironmentUseCase getUseCase;
    @MockitoBean
    private ListEnvironmentsUseCase listUseCase;
    @MockitoBean
    private DeleteEnvironmentUseCase deleteUseCase;

    private Environment lab101;

    @BeforeEach
    void setUp() {
        lab101 = new Environment();
        lab101.setEnvironmentId(10);
        lab101.setSchoolId(1);
        lab101.setCode("LAB-101");
        lab101.setName("Laboratorio 101");
        lab101.setCapacity((short) 40);
        lab101.setStatus(true);
        lab101.setRowVersion(1L);
    }

    @Nested
    @DisplayName("POST /api/v1/environments")
    class CreateTests {

        @Test
        @DisplayName("givenValidRequest_whenCreateEnvironment_thenReturn201WithJson")
        void givenValidRequest_whenCreateEnvironment_thenReturn201WithJson() throws Exception {
            // Arrange
            when(createUseCase.create(any(Environment.class))).thenReturn(lab101);

            // Act & Assert
            mockMvc.perform(post("/api/v1/environments")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"schoolId":1,"code":"LAB-101","name":"Laboratorio 101","capacity":40}"""))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.environmentId").value(10))
                    .andExpect(jsonPath("$.schoolId").value(1))
                    .andExpect(jsonPath("$.code").value("LAB-101"))
                    .andExpect(jsonPath("$.name").value("Laboratorio 101"))
                    .andExpect(jsonPath("$.capacity").value(40))
                    .andExpect(jsonPath("$.status").value(true))
                    .andExpect(jsonPath("$.rowVersion").value(1));

            verify(createUseCase).create(any(Environment.class));
        }

        @Test
        @DisplayName("givenBlankName_whenCreateEnvironment_thenReturn400FieldError")
        void givenBlankName_whenCreateEnvironment_thenReturn400FieldError() throws Exception {
            // Arrange: CreateEnvironmentRequest.name es @NotBlank

            // Act & Assert
            mockMvc.perform(post("/api/v1/environments")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"schoolId":1,"code":"LAB-101","name":"  ","capacity":40}"""))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error", containsString("name")));

            verify(createUseCase, never()).create(any(Environment.class));
        }

        @Test
        @DisplayName("givenDuplicatedCode_whenCreateEnvironment_thenReturn409Conflict")
        void givenDuplicatedCode_whenCreateEnvironment_thenReturn409Conflict() throws Exception {
            // Arrange: el use case lanza DuplicateEntityException ante (schoolId, code) repetido
            when(createUseCase.create(any(Environment.class)))
                    .thenThrow(new DuplicateEntityException(
                            "Environment already exists with schoolId=1 code=LAB-101"));

            // Act & Assert
            mockMvc.perform(post("/api/v1/environments")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"schoolId":1,"code":"LAB-101","name":"Laboratorio 101","capacity":40}"""))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error", containsString("already exists")));
        }
    }

    @Nested
    @DisplayName("GET /api/v1/environments y filtros")
    class ListTests {

        @Test
        @DisplayName("givenEnvironments_whenListAll_thenReturn200Array")
        void givenEnvironments_whenListAll_thenReturn200Array() throws Exception {
            // Arrange
            when(listUseCase.list()).thenReturn(List.of(lab101));

            // Act & Assert
            mockMvc.perform(get("/api/v1/environments"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].code").value("LAB-101"));

            verify(listUseCase).list();
            verify(listUseCase, never()).listBySchoolId(any());
        }

        @Test
        @DisplayName("givenSchoolIdQuery_whenListBySchool_thenReturn200Filtered")
        void givenSchoolIdQuery_whenListBySchool_thenReturn200Filtered() throws Exception {
            // Arrange
            when(listUseCase.listBySchoolId(7)).thenReturn(List.of(lab101));

            // Act & Assert: ruta corta dual + filtro por sede
            mockMvc.perform(get("/environments").param("schoolId", "7"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].schoolId").value(1));

            verify(listUseCase).listBySchoolId(7);
            verify(listUseCase, never()).list();
        }
    }

    @Nested
    @DisplayName("GET/PUT/DELETE /api/v1/environments/{id}")
    class CrudTests {

        @Test
        @DisplayName("givenExistingId_whenGetEnvironment_thenReturn200Json")
        void givenExistingId_whenGetEnvironment_thenReturn200Json() throws Exception {
            // Arrange
            when(getUseCase.getById(10)).thenReturn(lab101);

            // Act & Assert
            mockMvc.perform(get("/api/v1/environments/10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.environmentId").value(10))
                    .andExpect(jsonPath("$.code").value("LAB-101"))
                    .andExpect(jsonPath("$.capacity").value(40));
        }

        @Test
        @DisplayName("givenMissingId_whenGetEnvironment_thenReturn404WithErrorMessage")
        void givenMissingId_whenGetEnvironment_thenReturn404WithErrorMessage() throws Exception {
            // Arrange
            when(getUseCase.getById(999)).thenThrow(new EntityNotFoundException("Environment", 999));

            // Act & Assert: el advice de este modulo devuelve Map plano {"error":"..."}
            mockMvc.perform(get("/api/v1/environments/999"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("Environment not found with identifier=999"));
        }

        @Test
        @DisplayName("givenExistingId_whenUpdateEnvironment_thenReturn200WithMergedBody")
        void givenExistingId_whenUpdateEnvironment_thenReturn200WithMergedBody() throws Exception {
            // Arrange
            Environment renamed = new Environment();
            renamed.setEnvironmentId(10);
            renamed.setSchoolId(1);
            renamed.setCode("LAB-101");
            renamed.setName("Sala Renombrada");
            renamed.setCapacity((short) 40);
            renamed.setStatus(true);
            renamed.setRowVersion(2L);
            when(getUseCase.getById(10)).thenReturn(lab101);
            when(updateUseCase.update(eq(10), any(Environment.class))).thenReturn(renamed);

            // Act & Assert
            mockMvc.perform(put("/api/v1/environments/10")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"name":"Sala Renombrada"}"""))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Sala Renombrada"))
                    .andExpect(jsonPath("$.rowVersion").value(2));

            verify(updateUseCase).update(eq(10), any(Environment.class));
        }

        @Test
        @DisplayName("givenExistingId_whenDeleteEnvironment_thenReturn204")
        void givenExistingId_whenDeleteEnvironment_thenReturn204() throws Exception {
            // Arrange: delete() now fetches first (ownership check before deleting).
            when(getUseCase.getById(10)).thenReturn(lab101);

            // Act & Assert
            mockMvc.perform(delete("/api/v1/environments/10"))
                    .andExpect(status().isNoContent());

            verify(deleteUseCase).delete(10);
        }

        @Test
        @DisplayName("givenMissingId_whenDeleteEnvironment_thenReturn404")
        void givenMissingId_whenDeleteEnvironment_thenReturn404() throws Exception {
            // Arrange: the missing-id check now happens on the fetch, before deleteUseCase is ever called.
            when(getUseCase.getById(999)).thenThrow(new EntityNotFoundException("Environment", 999));

            // Act & Assert
            mockMvc.perform(delete("/api/v1/environments/999"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("Environment not found with identifier=999"));

            verify(deleteUseCase, never()).delete(999);
        }
    }
}
