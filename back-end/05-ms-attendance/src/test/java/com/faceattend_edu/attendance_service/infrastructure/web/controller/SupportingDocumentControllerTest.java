package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.in.GetAttendanceRecordUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.GetJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.CreateSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.DeleteSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.GetSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.ListSupportingDocumentsUseCase;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.SupportingDocumentWebMapper;
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

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SupportingDocumentController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(SupportingDocumentWebMapper.class)
@DisplayName("IEEE 829 TC-05: Supporting Document HTTP Tests")
class SupportingDocumentControllerTest {

    private static final String BASE = "/api/v1/supporting-documents";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CreateSupportingDocumentUseCase createUseCase;
    @MockitoBean
    private GetSupportingDocumentUseCase getUseCase;
    @MockitoBean
    private ListSupportingDocumentsUseCase listUseCase;
    @MockitoBean
    private DeleteSupportingDocumentUseCase deleteUseCase;
    @MockitoBean
    private GetJustificationUseCase justificationUseCase;
    @MockitoBean
    private GetAttendanceRecordUseCase recordUseCase;

    private SupportingDocument document(Long id, Long justificationId, String fileName) {
        SupportingDocument d = new SupportingDocument();
        d.setSupportingDocumentId(id);
        d.setJustificationId(justificationId);
        d.setFileName(fileName);
        d.setStorageUri("s3://faceattend/justifications/" + fileName);
        d.setMimeType("application/pdf");
        d.setSizeBytes(2048L);
        d.setCreatedAt(Instant.now());
        d.setRowVersion(1L);
        return d;
    }

    @Nested
    @DisplayName("TC-05-D01: Create supporting document")
    class CreateTests {

        @Test
        @DisplayName("Given valid document when POST then 201 with document body")
        void givenValidDocument_whenPost_thenReturn201() throws Exception {
            // Arrange
            when(createUseCase.create(any(SupportingDocument.class))).thenAnswer(call -> {
                SupportingDocument created = call.getArgument(0);
                created.setSupportingDocumentId(9L);
                return created;
            });

            // Act
            // Assert
            mockMvc.perform(post(BASE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"justificationId\":5,\"fileName\":\"certificado.pdf\","
                                    + "\"storageUri\":\"s3://faceattend/justifications/certificado.pdf\","
                                    + "\"mimeType\":\"application/pdf\",\"sizeBytes\":2048}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.supportingDocumentId").value(9))
                    .andExpect(jsonPath("$.justificationId").value(5))
                    .andExpect(jsonPath("$.fileName").value("certificado.pdf"))
                    .andExpect(jsonPath("$.storageUri").value("s3://faceattend/justifications/certificado.pdf"))
                    .andExpect(jsonPath("$.mimeType").value("application/pdf"))
                    .andExpect(jsonPath("$.sizeBytes").value(2048));
            verify(createUseCase).create(any(SupportingDocument.class));
        }

        @Test
        @DisplayName("Given sizeBytes zero when POST then 400 and use case never called")
        void givenSizeBytesZero_whenPost_thenReturn400() throws Exception {
            // Arrange

            // Act
            // Assert
            mockMvc.perform(post(BASE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"justificationId\":5,\"fileName\":\"certificado.pdf\","
                                    + "\"storageUri\":\"s3://bucket/certificado.pdf\","
                                    + "\"mimeType\":\"application/pdf\",\"sizeBytes\":0}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-002"))
                    .andExpect(jsonPath("$.error.message", containsString("sizeBytes")));
            verify(createUseCase, never()).create(any());
        }

        @Test
        @DisplayName("Given blank fileName when POST then 400 and use case never called")
        void givenBlankFileName_whenPost_thenReturn400() throws Exception {
            // Arrange

            // Act
            // Assert
            mockMvc.perform(post(BASE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"justificationId\":5,\"fileName\":\" \","
                                    + "\"storageUri\":\"s3://bucket/certificado.pdf\","
                                    + "\"mimeType\":\"application/pdf\",\"sizeBytes\":2048}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-002"))
                    .andExpect(jsonPath("$.error.message", containsString("fileName")));
            verify(createUseCase, never()).create(any());
        }
    }

    @Nested
    @DisplayName("TC-05-D02: Get supporting document")
    class GetTests {

        @Test
        @DisplayName("Given existing document when GET then 200 with body")
        void givenExistingDocument_whenGet_thenReturn200() throws Exception {
            // Arrange
            when(getUseCase.getById(9L)).thenReturn(document(9L, 5L, "certificado.pdf"));

            // Act
            // Assert
            mockMvc.perform(get(BASE + "/9"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.supportingDocumentId").value(9))
                    .andExpect(jsonPath("$.justificationId").value(5))
                    .andExpect(jsonPath("$.fileName").value("certificado.pdf"));
        }

        @Test
        @DisplayName("Given unknown document when GET then 404 ISO-8.5-INT-001")
        void givenUnknownDocument_whenGet_thenReturn404() throws Exception {
            // Arrange
            when(getUseCase.getById(999L)).thenThrow(new EntityNotFoundException("SupportingDocument", 999L));

            // Act
            // Assert
            mockMvc.perform(get(BASE + "/999"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-INT-001"));
        }
    }

    @Nested
    @DisplayName("TC-05-D03: List supporting documents")
    class ListTests {

        @Test
        @DisplayName("Given justificationId filter when GET then documents of that justification")
        void givenJustificationIdFilter_whenGet_thenReturnFiltered() throws Exception {
            // Arrange
            when(listUseCase.listByJustificationId(5L))
                    .thenReturn(List.of(document(9L, 5L, "certificado.pdf")));

            // Act
            // Assert
            mockMvc.perform(get(BASE).param("justificationId", "5"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].justificationId").value(5));
            verify(listUseCase).listByJustificationId(5L);
            verify(listUseCase, never()).list();
        }

        @Test
        @DisplayName("Given no filter when GET then all documents")
        void givenNoFilter_whenGet_thenReturnAll() throws Exception {
            // Arrange
            when(listUseCase.list()).thenReturn(List.of(
                    document(9L, 5L, "certificado.pdf"),
                    document(10L, 6L, "recibo.pdf")));

            // Act
            // Assert
            mockMvc.perform(get(BASE))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2));
            verify(listUseCase).list();
            verify(listUseCase, never()).listByJustificationId(any());
        }
    }

    @Nested
    @DisplayName("TC-05-D04: Delete supporting document")
    class DeleteTests {

        @Test
        @DisplayName("Given existing document when DELETE then 204")
        void givenExistingDocument_whenDelete_thenReturn204() throws Exception {
            // Arrange

            // Act
            // Assert
            mockMvc.perform(delete(BASE + "/9"))
                    .andExpect(status().isNoContent());
            verify(deleteUseCase).delete(9L);
        }
    }
}
