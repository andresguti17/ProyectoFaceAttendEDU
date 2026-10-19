package com.faceattend_edu.scheduling_service.infrastructure.web.controller;

import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.exception.ValidationException;
import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.port.in.CancelClassSessionUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.CloseClassSessionUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.CreateClassSessionUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.DeleteClassSessionUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.GetClassSessionUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.GetEnvironmentUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.GetScheduleBlockUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.ListClassSessionsUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.OpenClassSessionUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.UpdateClassSessionUseCase;
import com.faceattend_edu.scheduling_service.infrastructure.web.mapper.ClassSessionWebMapper;
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

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Cobertura HTTP (MockMvc) de {@code ClassSessionController}.
 *
 * <p>Ademas del CRUD, cubre el ciclo de vida Open/Closed/Cancelled
 * ({@code POST /{id}/open|close|cancel}): transiciones validas, transiciones
 * invalidas (mensajes EXACTOS de los use cases: {@code "ClassSession already Open"},
 * {@code "Cannot close a Cancelled session"}, {@code "Cannot cancel a Closed session"})
 * y sesion inexistente. El {@code ClassSessionWebMapper} se importa real para
 * comprobar que {@code sessionStatus} nulo mapea a {@code "Open"} por defecto.</p>
 */
@WebMvcTest(controllers = ClassSessionController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(ClassSessionWebMapper.class)
@DisplayName("IEEE 829 TC-04-002: ClassSessionController HTTP tests (MockMvc)")
class ClassSessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CreateClassSessionUseCase createUseCase;
    @MockitoBean
    private UpdateClassSessionUseCase updateUseCase;
    @MockitoBean
    private GetClassSessionUseCase getUseCase;
    @MockitoBean
    private ListClassSessionsUseCase listUseCase;
    @MockitoBean
    private DeleteClassSessionUseCase deleteUseCase;
    @MockitoBean
    private OpenClassSessionUseCase openUseCase;
    @MockitoBean
    private CloseClassSessionUseCase closeUseCase;
    @MockitoBean
    private CancelClassSessionUseCase cancelUseCase;
    @MockitoBean
    private GetScheduleBlockUseCase getScheduleBlockUseCase;
    @MockitoBean
    private GetEnvironmentUseCase getEnvironmentUseCase;

    private ClassSession openSession;

    @BeforeEach
    void setUp() {
        openSession = new ClassSession();
        openSession.setClassSessionId(5L);
        openSession.setScheduleBlockId(100L);
        openSession.setSessionDate(LocalDate.of(2026, 3, 2));
        openSession.setSessionStatus("Open");
        openSession.setRowVersion(1L);
    }

    private static ClassSession withStatus(ClassSession base, String status) {
        ClassSession copy = new ClassSession();
        copy.setClassSessionId(base.getClassSessionId());
        copy.setScheduleBlockId(base.getScheduleBlockId());
        copy.setSessionDate(base.getSessionDate());
        copy.setSessionStatus(status);
        copy.setRowVersion(2L);
        return copy;
    }

    @Nested
    @DisplayName("POST /api/v1/class-sessions")
    class CreateTests {

        @Test
        @DisplayName("givenValidRequest_whenCreateClassSession_thenReturn201WithDefaultOpenStatus")
        void givenValidRequest_whenCreateClassSession_thenReturn201WithDefaultOpenStatus() throws Exception {
            // Arrange: el mapper real (importado) debe poner sessionStatus="Open" si viene nulo
            when(createUseCase.create(any(ClassSession.class))).thenReturn(openSession);

            // Act & Assert
            mockMvc.perform(post("/api/v1/class-sessions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"scheduleBlockId":100,"sessionDate":"2026-03-02"}"""))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.classSessionId").value(5))
                    .andExpect(jsonPath("$.scheduleBlockId").value(100))
                    .andExpect(jsonPath("$.sessionDate").value("2026-03-02"))
                    .andExpect(jsonPath("$.sessionStatus").value("Open"));

            // El default "Open" vive en el mapper: se captura el dominio recibido por el use case
            ArgumentCaptor<ClassSession> captor = ArgumentCaptor.forClass(ClassSession.class);
            verify(createUseCase).create(captor.capture());
            assertEquals("Open", captor.getValue().getSessionStatus());
            assertEquals(LocalDate.of(2026, 3, 2), captor.getValue().getSessionDate());
        }

        @Test
        @DisplayName("givenMissingSessionDate_whenCreateClassSession_thenReturn400FieldError")
        void givenMissingSessionDate_whenCreateClassSession_thenReturn400FieldError() throws Exception {
            // Arrange: CreateClassSessionRequest.sessionDate es @NotNull

            // Act & Assert
            mockMvc.perform(post("/api/v1/class-sessions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"scheduleBlockId":100}"""))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("sessionDate: must not be null"));

            verify(createUseCase, never()).create(any(ClassSession.class));
        }
    }

    @Nested
    @DisplayName("GET/PUT/DELETE /api/v1/class-sessions")
    class CrudTests {

        @Test
        @DisplayName("givenExistingId_whenGetClassSession_thenReturn200Json")
        void givenExistingId_whenGetClassSession_thenReturn200Json() throws Exception {
            // Arrange
            when(getUseCase.getById(5L)).thenReturn(openSession);

            // Act & Assert
            mockMvc.perform(get("/api/v1/class-sessions/5"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.classSessionId").value(5))
                    .andExpect(jsonPath("$.scheduleBlockId").value(100))
                    .andExpect(jsonPath("$.sessionDate").value("2026-03-02"))
                    .andExpect(jsonPath("$.sessionStatus").value("Open"));
        }

        @Test
        @DisplayName("givenMissingId_whenGetClassSession_thenReturn404WithErrorMessage")
        void givenMissingId_whenGetClassSession_thenReturn404WithErrorMessage() throws Exception {
            // Arrange
            when(getUseCase.getById(999L)).thenThrow(new EntityNotFoundException("ClassSession", 999L));

            // Act & Assert
            mockMvc.perform(get("/api/v1/class-sessions/999"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("ClassSession not found with identifier=999"));
        }

        @Test
        @DisplayName("givenExistingId_whenUpdateClassSession_thenReturn200")
        void givenExistingId_whenUpdateClassSession_thenReturn200() throws Exception {
            // Arrange
            ClassSession closed = withStatus(openSession, "Closed");
            when(updateUseCase.update(org.mockito.ArgumentMatchers.eq(5L), any(ClassSession.class)))
                    .thenReturn(closed);

            // Act & Assert
            mockMvc.perform(put("/api/v1/class-sessions/5")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"sessionStatus":"Closed"}"""))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.sessionStatus").value("Closed"));

            verify(updateUseCase).update(org.mockito.ArgumentMatchers.eq(5L), any(ClassSession.class));
        }

        @Test
        @DisplayName("givenExistingId_whenDeleteClassSession_thenReturn204")
        void givenExistingId_whenDeleteClassSession_thenReturn204() throws Exception {
            // Act & Assert
            mockMvc.perform(delete("/api/v1/class-sessions/5"))
                    .andExpect(status().isNoContent());

            verify(deleteUseCase).delete(5L);
        }

        @Test
        @DisplayName("givenSessionsFilteredByBlock_whenList_thenReturnSliceWithTotalCount")
        void givenSessionsFilteredByBlock_whenList_thenReturnSliceWithTotalCount() throws Exception {
            // Arrange: el filtro scheduleBlockId y el recorte limit/offset viven en el controller/Paging
            ClassSession other = new ClassSession();
            other.setClassSessionId(6L);
            other.setScheduleBlockId(200L);
            other.setSessionDate(LocalDate.of(2026, 3, 3));
            other.setSessionStatus("Open");
            other.setRowVersion(1L);
            when(listUseCase.list()).thenReturn(List.of(openSession, other));

            // Act & Assert
            mockMvc.perform(get("/api/v1/class-sessions")
                            .param("scheduleBlockId", "100")
                            .param("limit", "10"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("X-Total-Count", "1"))
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].scheduleBlockId").value(100));
        }
    }

    @Nested
    @DisplayName("POST /api/v1/class-sessions/{id}/open|close|cancel")
    class LifecycleTests {

        @Test
        @DisplayName("givenOpenableSession_whenOpen_thenReturn200Open")
        void givenOpenableSession_whenOpen_thenReturn200Open() throws Exception {
            // Arrange: openedBy is no longer read from the request body (it was
            // spoofable) — the controller derives it from the caller's own actor,
            // which is null outside the real AuthTokenFilter (addFilters=false here).
            when(openUseCase.open(5L, null)).thenReturn(openSession);

            // Act & Assert: a body, even with an openedBy, is ignored.
            mockMvc.perform(post("/api/v1/class-sessions/5/open")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"openedBy":77}"""))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.sessionStatus").value("Open"));

            verify(openUseCase).open(5L, null);
        }

        @Test
        @DisplayName("givenAlreadyOpenSession_whenOpen_thenReturn400WithExactMessage")
        void givenAlreadyOpenSession_whenOpen_thenReturn400WithExactMessage() throws Exception {
            // Arrange: mensaje EXACTO de OpenClassSessionUseCaseImpl
            when(openUseCase.open(5L, null))
                    .thenThrow(new ValidationException("ClassSession already Open"));

            // Act & Assert: sin body -> openedBy null
            mockMvc.perform(post("/api/v1/class-sessions/5/open"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("ClassSession already Open"));
        }

        @Test
        @DisplayName("givenMissingSession_whenOpen_thenReturn404")
        void givenMissingSession_whenOpen_thenReturn404() throws Exception {
            // Arrange
            when(openUseCase.open(999L, null))
                    .thenThrow(new EntityNotFoundException("ClassSession", 999L));

            // Act & Assert
            mockMvc.perform(post("/api/v1/class-sessions/999/open"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("ClassSession not found with identifier=999"));
        }

        @Test
        @DisplayName("givenOpenSession_whenClose_thenReturn200Closed")
        void givenOpenSession_whenClose_thenReturn200Closed() throws Exception {
            // Arrange: closedBy is no longer read from the request body (it was
            // spoofable) — null here outside the real AuthTokenFilter.
            ClassSession closed = withStatus(openSession, "Closed");
            closed.setClosedBy(88L);
            when(closeUseCase.close(5L, null)).thenReturn(closed);

            // Act & Assert: a body, even with a closedBy, is ignored.
            mockMvc.perform(post("/api/v1/class-sessions/5/close")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"closedBy":88}"""))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.sessionStatus").value("Closed"))
                    .andExpect(jsonPath("$.closedBy").value(88));

            verify(closeUseCase).close(5L, null);
        }

        @Test
        @DisplayName("givenCancelledSession_whenClose_thenReturn400WithExactMessage")
        void givenCancelledSession_whenClose_thenReturn400WithExactMessage() throws Exception {
            // Arrange: mensaje EXACTO de CloseClassSessionUseCaseImpl
            when(closeUseCase.close(5L, null))
                    .thenThrow(new ValidationException("Cannot close a Cancelled session"));

            // Act & Assert
            mockMvc.perform(post("/api/v1/class-sessions/5/close"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Cannot close a Cancelled session"));
        }

        @Test
        @DisplayName("givenOpenSession_whenCancel_thenReturn200Cancelled")
        void givenOpenSession_whenCancel_thenReturn200Cancelled() throws Exception {
            // Arrange
            when(cancelUseCase.cancel(5L)).thenReturn(withStatus(openSession, "Cancelled"));

            // Act & Assert
            mockMvc.perform(post("/api/v1/class-sessions/5/cancel"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.sessionStatus").value("Cancelled"));

            verify(cancelUseCase).cancel(5L);
        }

        @Test
        @DisplayName("givenClosedSession_whenCancel_thenReturn400WithExactMessage")
        void givenClosedSession_whenCancel_thenReturn400WithExactMessage() throws Exception {
            // Arrange: mensaje EXACTO de CancelClassSessionUseCaseImpl
            when(cancelUseCase.cancel(5L))
                    .thenThrow(new ValidationException("Cannot cancel a Closed session"));

            // Act & Assert
            mockMvc.perform(post("/api/v1/class-sessions/5/cancel"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Cannot cancel a Closed session"));
        }

        @Test
        @DisplayName("givenMissingSession_whenCancel_thenReturn404")
        void givenMissingSession_whenCancel_thenReturn404() throws Exception {
            // Arrange
            when(cancelUseCase.cancel(999L))
                    .thenThrow(new EntityNotFoundException("ClassSession", 999L));

            // Act & Assert
            mockMvc.perform(post("/api/v1/class-sessions/999/cancel"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("ClassSession not found with identifier=999"));
        }
    }
}
