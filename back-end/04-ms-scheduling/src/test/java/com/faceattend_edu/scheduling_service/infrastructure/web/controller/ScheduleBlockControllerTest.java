package com.faceattend_edu.scheduling_service.infrastructure.web.controller;

import com.faceattend_edu.scheduling_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.in.CreateScheduleBlockUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.DeleteScheduleBlockUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.GetEnvironmentUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.GetScheduleBlockUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.ListScheduleBlocksUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.UpdateScheduleBlockUseCase;
import com.faceattend_edu.scheduling_service.infrastructure.web.mapper.ScheduleBlockWebMapper;
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

import java.time.LocalTime;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
 * Cobertura HTTP (MockMvc) de {@code ScheduleBlockController}.
 *
 * <p>Valida ademas de CRUD: la validacion bean {@code @Min(1)/@Max(7)} de
 * {@code dayOfWeek} (400), el type mismatch del path variable ({@code GET /abc} ->
 * 400 con el mensaje del handler), la paginacion {@code Paging} (header
 * {@code X-Total-Count}) y el solape de doble reserva del overlapGuard
 * ({@code DuplicateEntityException} -> 409).</p>
 */
@WebMvcTest(controllers = ScheduleBlockController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(ScheduleBlockWebMapper.class)
@DisplayName("IEEE 829 TC-04-003: ScheduleBlockController HTTP tests (MockMvc)")
class ScheduleBlockControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CreateScheduleBlockUseCase createUseCase;
    @MockitoBean
    private UpdateScheduleBlockUseCase updateUseCase;
    @MockitoBean
    private GetScheduleBlockUseCase getUseCase;
    @MockitoBean
    private ListScheduleBlocksUseCase listUseCase;
    @MockitoBean
    private DeleteScheduleBlockUseCase deleteUseCase;
    @MockitoBean
    private GetEnvironmentUseCase getEnvironmentUseCase;

    private ScheduleBlock mondayMorning;

    @BeforeEach
    void setUp() {
        mondayMorning = new ScheduleBlock();
        mondayMorning.setScheduleBlockId(9L);
        mondayMorning.setCohortId(50L);
        mondayMorning.setCourseId(12);
        mondayMorning.setEnvironmentId(501);
        mondayMorning.setInstructorActorId(601L);
        mondayMorning.setDayOfWeek((short) 1);
        mondayMorning.setStartsAt(LocalTime.of(8, 0));
        mondayMorning.setEndsAt(LocalTime.of(10, 0));
        mondayMorning.setRowVersion(1L);
    }

    private static ScheduleBlock numberedBlock(long id) {
        ScheduleBlock block = new ScheduleBlock();
        block.setScheduleBlockId(id);
        block.setCohortId(50L);
        block.setCourseId(12);
        block.setEnvironmentId(501 + (int) id);
        block.setInstructorActorId(601L + id);
        block.setDayOfWeek((short) 1);
        block.setStartsAt(LocalTime.of(8, 0));
        block.setEndsAt(LocalTime.of(10, 0));
        block.setRowVersion(1L);
        return block;
    }

    @Nested
    @DisplayName("POST /api/v1/schedule-blocks")
    class CreateTests {

        @Test
        @DisplayName("givenValidRequest_whenCreateScheduleBlock_thenReturn201WithJson")
        void givenValidRequest_whenCreateScheduleBlock_thenReturn201WithJson() throws Exception {
            // Arrange
            when(createUseCase.create(any(ScheduleBlock.class))).thenReturn(mondayMorning);

            // Act & Assert
            mockMvc.perform(post("/api/v1/schedule-blocks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"cohortId":50,"courseId":12,"environmentId":501,"instructorActorId":601,\
                                    "dayOfWeek":1,"startsAt":"08:00:00","endsAt":"10:00:00"}"""))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.scheduleBlockId").value(9))
                    .andExpect(jsonPath("$.cohortId").value(50))
                    .andExpect(jsonPath("$.courseId").value(12))
                    .andExpect(jsonPath("$.environmentId").value(501))
                    .andExpect(jsonPath("$.instructorActorId").value(601))
                    .andExpect(jsonPath("$.dayOfWeek").value(1))
                    .andExpect(jsonPath("$.startsAt").value("08:00:00"))
                    .andExpect(jsonPath("$.endsAt").value("10:00:00"))
                    .andExpect(jsonPath("$.rowVersion").value(1));

            verify(createUseCase).create(any(ScheduleBlock.class));
        }

        @Test
        @DisplayName("givenDayOfWeekOutOfRange_whenCreateScheduleBlock_thenReturn400FieldError")
        void givenDayOfWeekOutOfRange_whenCreateScheduleBlock_thenReturn400FieldError() throws Exception {
            // Arrange: CreateScheduleBlockRequest.dayOfWeek es @Min(1) @Max(7)

            // Act & Assert
            mockMvc.perform(post("/api/v1/schedule-blocks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"cohortId":50,"courseId":12,"environmentId":501,"instructorActorId":601,\
                                    "dayOfWeek":8,"startsAt":"08:00:00","endsAt":"10:00:00"}"""))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error", containsString("dayOfWeek")));

            verify(createUseCase, never()).create(any(ScheduleBlock.class));
        }

        @Test
        @DisplayName("givenMissingRequiredField_whenCreateScheduleBlock_thenReturn400FieldError")
        void givenMissingRequiredField_whenCreateScheduleBlock_thenReturn400FieldError() throws Exception {
            // Arrange: falta endsAt (@NotNull)

            // Act & Assert
            mockMvc.perform(post("/api/v1/schedule-blocks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"cohortId":50,"courseId":12,"environmentId":501,"instructorActorId":601,\
                                    "dayOfWeek":2,"startsAt":"08:00:00"}"""))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error", containsString("endsAt")));

            verify(createUseCase, never()).create(any(ScheduleBlock.class));
        }

        @Test
        @DisplayName("givenOverlappingBlock_whenCreateScheduleBlock_thenReturn409Conflict")
        void givenOverlappingBlock_whenCreateScheduleBlock_thenReturn409Conflict() throws Exception {
            // Arrange: ScheduleBlockOverlapGuard lanza DuplicateEntityException ante doble reserva
            when(createUseCase.create(any(ScheduleBlock.class)))
                    .thenThrow(new DuplicateEntityException(
                            "Environment 501 is already booked between 08:00:00 and 10:00:00 on day 1"));

            // Act & Assert
            mockMvc.perform(post("/api/v1/schedule-blocks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"cohortId":50,"courseId":12,"environmentId":501,"instructorActorId":601,\
                                    "dayOfWeek":1,"startsAt":"08:00:00","endsAt":"10:00:00"}"""))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error", containsString("already booked")));
        }
    }

    @Nested
    @DisplayName("GET/PUT/DELETE /api/v1/schedule-blocks")
    class CrudTests {

        @Test
        @DisplayName("givenExistingId_whenGetScheduleBlock_thenReturn200Json")
        void givenExistingId_whenGetScheduleBlock_thenReturn200Json() throws Exception {
            // Arrange
            when(getUseCase.getById(9L)).thenReturn(mondayMorning);

            // Act & Assert
            mockMvc.perform(get("/api/v1/schedule-blocks/9"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.scheduleBlockId").value(9))
                    .andExpect(jsonPath("$.environmentId").value(501))
                    .andExpect(jsonPath("$.startsAt").value("08:00:00"))
                    .andExpect(jsonPath("$.endsAt").value("10:00:00"));
        }

        @Test
        @DisplayName("givenMissingId_whenGetScheduleBlock_thenReturn404WithErrorMessage")
        void givenMissingId_whenGetScheduleBlock_thenReturn404WithErrorMessage() throws Exception {
            // Arrange
            when(getUseCase.getById(999L)).thenThrow(new EntityNotFoundException("ScheduleBlock", 999L));

            // Act & Assert
            mockMvc.perform(get("/api/v1/schedule-blocks/999"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("ScheduleBlock not found with identifier=999"));
        }

        @Test
        @DisplayName("givenNonNumericId_whenGetScheduleBlock_thenReturn400TypeMismatch")
        void givenNonNumericId_whenGetScheduleBlock_thenReturn400TypeMismatch() throws Exception {
            // Act & Assert: el handler MethodArgumentTypeMismatchException responde
            mockMvc.perform(get("/api/v1/schedule-blocks/abc"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Invalid value for parameter 'id'"));

            verify(getUseCase, never()).getById(any());
        }

        @Test
        @DisplayName("givenExistingId_whenUpdateScheduleBlock_thenReturn200")
        void givenExistingId_whenUpdateScheduleBlock_thenReturn200() throws Exception {
            // Arrange: update() now fetches first (ownership check before updating).
            when(getUseCase.getById(9L)).thenReturn(mondayMorning);
            when(updateUseCase.update(eq(9L), any(ScheduleBlock.class))).thenReturn(mondayMorning);

            // Act & Assert
            mockMvc.perform(put("/api/v1/schedule-blocks/9")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"dayOfWeek":3,"startsAt":"10:00:00","endsAt":"12:00:00"}"""))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.scheduleBlockId").value(9))
                    .andExpect(jsonPath("$.dayOfWeek").value(1));

            verify(updateUseCase).update(eq(9L), any(ScheduleBlock.class));
        }

        @Test
        @DisplayName("givenExistingId_whenDeleteScheduleBlock_thenReturn204")
        void givenExistingId_whenDeleteScheduleBlock_thenReturn204() throws Exception {
            // Arrange: delete() now fetches first (ownership check before deleting).
            when(getUseCase.getById(9L)).thenReturn(mondayMorning);

            // Act & Assert
            mockMvc.perform(delete("/api/v1/schedule-blocks/9"))
                    .andExpect(status().isNoContent());

            verify(deleteUseCase).delete(9L);
        }
    }

    @Nested
    @DisplayName("GET /api/v1/schedule-blocks con limit/offset (Paging)")
    class PagingTests {

        @Test
        @DisplayName("givenLimitAndOffset_whenListScheduleBlocks_thenReturnSliceWithTotalCountHeader")
        void givenLimitAndOffset_whenListScheduleBlocks_thenReturnSliceWithTotalCountHeader() throws Exception {
            // Arrange: 3 bloques; Paging.slice recorta [offset, offset+limit) pero
            // X-Total-Count refleja el total de la lista filtrada
            when(listUseCase.list())
                    .thenReturn(List.of(numberedBlock(1L), numberedBlock(2L), numberedBlock(3L)));

            // Act & Assert
            mockMvc.perform(get("/api/v1/schedule-blocks")
                            .param("limit", "2")
                            .param("offset", "1"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("X-Total-Count", "3"))
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].scheduleBlockId").value(2))
                    .andExpect(jsonPath("$[1].scheduleBlockId").value(3));
        }

        @Test
        @DisplayName("givenNoPagingParams_whenListScheduleBlocks_thenReturnFullListWithoutHeader")
        void givenNoPagingParams_whenListScheduleBlocks_thenReturnFullListWithoutHeader() throws Exception {
            // Arrange
            when(listUseCase.list()).thenReturn(List.of(numberedBlock(1L), numberedBlock(2L)));

            // Act & Assert: sin limit/offset no hay header X-Total-Count (contrato de Paging)
            mockMvc.perform(get("/api/v1/schedule-blocks"))
                    .andExpect(status().isOk())
                    .andExpect(header().doesNotExist("X-Total-Count"))
                    .andExpect(jsonPath("$.length()").value(2));
        }
    }
}
