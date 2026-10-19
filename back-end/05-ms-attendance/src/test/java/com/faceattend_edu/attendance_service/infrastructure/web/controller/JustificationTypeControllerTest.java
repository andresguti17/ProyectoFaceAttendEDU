package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.domain.port.in.CreateJustificationTypeUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.DeleteJustificationTypeUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.GetJustificationTypeUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.ListJustificationTypesUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.UpdateJustificationTypeUseCase;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.JustificationTypeWebMapper;
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

import java.time.Instant;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = JustificationTypeController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(JustificationTypeWebMapper.class)
@DisplayName("IEEE 829 TC-05: Justification Type HTTP Tests")
class JustificationTypeControllerTest {

    private static final String BASE = "/api/v1/justification-types";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CreateJustificationTypeUseCase createUseCase;
    @MockitoBean
    private UpdateJustificationTypeUseCase updateUseCase;
    @MockitoBean
    private GetJustificationTypeUseCase getUseCase;
    @MockitoBean
    private ListJustificationTypesUseCase listUseCase;
    @MockitoBean
    private DeleteJustificationTypeUseCase deleteUseCase;

    private JustificationType type(Integer id, Integer schoolId, String name) {
        JustificationType t = new JustificationType();
        t.setJustificationTypeId(id);
        t.setSchoolId(schoolId);
        t.setName(name);
        t.setRequiresAttachment(false);
        t.setStatus(true);
        t.setCreatedAt(Instant.now());
        t.setRowVersion(1L);
        return t;
    }

    @Nested
    @DisplayName("TC-05-T01: Create justification type")
    class CreateTests {

        @Test
        @DisplayName("Given global type (schoolId null) when POST then 201 with schoolId null")
        void givenGlobalType_whenPost_thenReturn201() throws Exception {
            // Arrange
            when(createUseCase.create(any(JustificationType.class))).thenAnswer(call -> {
                JustificationType created = call.getArgument(0);
                created.setJustificationTypeId(3);
                return created;
            });

            // Act
            // Assert
            mockMvc.perform(post(BASE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Medical leave\",\"description\":\"Certificado medico\"}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.justificationTypeId").value(3))
                    .andExpect(jsonPath("$.schoolId").value(nullValue()))
                    .andExpect(jsonPath("$.name").value("Medical leave"))
                    .andExpect(jsonPath("$.requiresAttachment").value(false))
                    .andExpect(jsonPath("$.status").value(true));

            ArgumentCaptor<JustificationType> captor = ArgumentCaptor.forClass(JustificationType.class);
            verify(createUseCase).create(captor.capture());
            assertNull(captor.getValue().getSchoolId());
            assertEquals("Medical leave", captor.getValue().getName());
        }

        @Test
        @DisplayName("Given duplicate global type when POST then 409 ISO-8.5-DUP-001")
        void givenDuplicateGlobalType_whenPost_thenReturn409() throws Exception {
            // Arrange
            when(createUseCase.create(any(JustificationType.class)))
                    .thenThrow(new DuplicateEntityException("Global JustificationType already exists with name=Medical leave"));

            // Act
            // Assert
            mockMvc.perform(post(BASE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Medical leave\"}"))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-DUP-001"));
        }

        @Test
        @DisplayName("Given blank name when POST then 400 and use case never called")
        void givenBlankName_whenPost_thenReturn400() throws Exception {
            // Arrange

            // Act
            // Assert
            mockMvc.perform(post(BASE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\" \"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-002"))
                    .andExpect(jsonPath("$.error.message", containsString("name")));
            verify(createUseCase, never()).create(any());
        }
    }

    @Nested
    @DisplayName("TC-05-T02: List and get justification types")
    class ListAndGetTests {

        @Test
        @DisplayName("Given existing types when GET list then 200 with all entries")
        void givenExistingTypes_whenGetList_thenReturn200() throws Exception {
            // Arrange
            when(listUseCase.list()).thenReturn(List.of(
                    type(1, null, "Medical leave"),
                    type(2, 7, "Domestic calamity")));

            // Act
            // Assert
            mockMvc.perform(get(BASE))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].name").value("Medical leave"))
                    .andExpect(jsonPath("$[1].schoolId").value(7));
        }

        @Test
        @DisplayName("Given existing type when GET by id then 200")
        void givenExistingType_whenGetById_thenReturn200() throws Exception {
            // Arrange
            when(getUseCase.getById(1)).thenReturn(type(1, null, "Medical leave"));

            // Act
            // Assert
            mockMvc.perform(get(BASE + "/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.justificationTypeId").value(1))
                    .andExpect(jsonPath("$.name").value("Medical leave"));
        }

        @Test
        @DisplayName("Given unknown type when GET by id then 404 ISO-8.5-INT-001")
        void givenUnknownType_whenGetById_thenReturn404() throws Exception {
            // Arrange
            when(getUseCase.getById(999)).thenThrow(new EntityNotFoundException("JustificationType", 999));

            // Act
            // Assert
            mockMvc.perform(get(BASE + "/999"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-INT-001"));
        }
    }

    @Nested
    @DisplayName("TC-05-T03: Update justification type")
    class UpdateTests {

        @Test
        @DisplayName("Given renamed type when PUT then 200 with updated body")
        void givenRenamedType_whenPut_thenReturn200() throws Exception {
            // Arrange: update() now fetches first (ownership check before updating).
            when(getUseCase.getById(1)).thenReturn(type(1, null, "Medical leave"));
            JustificationType updated = type(1, null, "Renamed leave");
            updated.setStatus(false);
            when(updateUseCase.update(eq(1), any(JustificationType.class))).thenReturn(updated);

            // Act
            // Assert
            mockMvc.perform(put(BASE + "/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Renamed leave\",\"status\":false}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.justificationTypeId").value(1))
                    .andExpect(jsonPath("$.name").value("Renamed leave"))
                    .andExpect(jsonPath("$.status").value(false));

            ArgumentCaptor<JustificationType> captor = ArgumentCaptor.forClass(JustificationType.class);
            verify(updateUseCase).update(eq(1), captor.capture());
            assertEquals("Renamed leave", captor.getValue().getName());
            assertEquals(Boolean.FALSE, captor.getValue().getStatus());
        }
    }

    @Nested
    @DisplayName("TC-05-T04: Delete justification type")
    class DeleteTests {

        @Test
        @DisplayName("Given existing type when DELETE then 204")
        void givenExistingType_whenDelete_thenReturn204() throws Exception {
            // Arrange: delete() now fetches first (ownership check before deleting).
            when(getUseCase.getById(1)).thenReturn(type(1, null, "Medical leave"));

            // Act
            // Assert
            mockMvc.perform(delete(BASE + "/1"))
                    .andExpect(status().isNoContent());
            verify(deleteUseCase).delete(1);
        }

        @Test
        @DisplayName("Given unknown type when DELETE then 404 ISO-8.5-INT-001")
        void givenUnknownType_whenDelete_thenReturn404() throws Exception {
            // Arrange: delete() now fetches first (ownership check before deleting),
            // so the 404 now comes from that fetch instead of deleteUseCase.
            when(getUseCase.getById(999)).thenThrow(new EntityNotFoundException("JustificationType", 999));

            // Act
            // Assert
            mockMvc.perform(delete(BASE + "/999"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-INT-001"));
        }
    }
}
