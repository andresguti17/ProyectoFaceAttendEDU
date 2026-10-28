package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.application.port.in.ManageGuardianDocumentUseCase;
import com.faceattend_edu.identity_service.application.port.in.ManageGuardianUseCase;
import com.faceattend_edu.identity_service.application.port.in.ManageTermsUseCase;
import com.faceattend_edu.identity_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.identity_service.domain.exception.ForbiddenException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.Enablement;
import com.faceattend_edu.identity_service.domain.model.Guardian;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {TermsController.class, GuardianController.class})
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("Terms and guardian endpoints")
class TermsAndGuardianControllerTest {

    private static final String GUARDIAN_JSON = "{\"fullName\":\"Ana Gómez\",\"documentType\":\"CC\",\"documentNumber\":\"5005\","
            + "\"email\":\"ana@correo.co\",\"phone\":\"3001234567\",\"relationship\":\"Madre\"}";

    @Autowired MockMvc mockMvc;
    @MockitoBean ManageTermsUseCase termsUseCase;
    @MockitoBean ManageGuardianUseCase guardianUseCase;
    @MockitoBean ManageGuardianDocumentUseCase documentUseCase;

    private final UUID personId = UUID.randomUUID();
    private final UUID caller = UUID.randomUUID();

    private RequestPostProcessor asAdmin() {
        return request -> {
            request.setAttribute("X-User-Id", caller.toString());
            request.setAttribute("X-User-Roles", List.of("Administrador"));
            request.addHeader("Authorization", "Bearer abc");
            return request;
        };
    }

    private Enablement enablement(Enablement.Status status, boolean minor, boolean guardian) {
        return new Enablement(personId, minor, guardian, status == Enablement.Status.ENABLED, status == Enablement.Status.ENABLED,
                null, LocalDateTime.now(), "2026-10", status);
    }

    @Test
    void aMinorWithoutGuardianIsToldWhichStepIsPending() throws Exception {
        when(termsUseCase.enablement(eq(personId), any())).thenReturn(enablement(Enablement.Status.GUARDIAN_PENDING, true, false));

        mockMvc.perform(get("/api/v1/persons/{id}/terms", personId).with(asAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pendingStep").value("GUARDIAN"))
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.minor").value(true));
    }

    @Test
    void aFullyEnabledPersonHasNoPendingStep() throws Exception {
        when(termsUseCase.enablement(eq(personId), any())).thenReturn(enablement(Enablement.Status.ENABLED, false, false));

        mockMvc.perform(get("/api/v1/persons/{id}/terms", personId).with(asAdmin()))
                .andExpect(jsonPath("$.pendingStep").value("NONE"))
                .andExpect(jsonPath("$.enabled").value(true));
    }

    @Test
    void acceptingTheTermsAnswers201WithTheNewEnablement() throws Exception {
        when(termsUseCase.accept(eq(personId), eq("2026-10"), eq(caller), any(), eq("abc")))
                .thenReturn(enablement(Enablement.Status.ENABLED, true, true));

        mockMvc.perform(post("/api/v1/persons/{id}/terms", personId).with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"termsVersion\":\"2026-10\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ENABLED"));
    }

    @Test
    void aMinorCannotAcceptTheirOwnTermsAndGets403() throws Exception {
        when(termsUseCase.accept(any(), any(), any(), any(), any())).thenThrow(new ForbiddenException("guardian in person"));

        mockMvc.perform(post("/api/v1/persons/{id}/terms", personId).with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"termsVersion\":\"2026-10\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN"));
    }

    @Test
    void theTermsVersionIsRequired() throws Exception {
        mockMvc.perform(post("/api/v1/persons/{id}/terms", personId).with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(termsUseCase);
    }

    @Test
    void withoutASessionTheTermsRequestIs401() throws Exception {
        mockMvc.perform(get("/api/v1/persons/{id}/terms", personId)).andExpect(status().isUnauthorized());
    }

    @Test
    void registeringAGuardianAnswers201() throws Exception {
        when(guardianUseCase.register(eq(personId), any(), eq(caller), any(), eq("abc"))).thenReturn(guardian());

        mockMvc.perform(post("/api/v1/persons/{id}/guardian", personId).with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content(GUARDIAN_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fullName").value("Ana Gómez"))
                .andExpect(jsonPath("$.minorPersonId").value(personId.toString()));
    }

    @Test
    void aSecondGuardianIsRejectedWith409AndInvalidDataWith400() throws Exception {
        when(guardianUseCase.register(any(), any(), any(), any(), any())).thenThrow(new DuplicateEntityException("Guardian", personId));
        mockMvc.perform(post("/api/v1/persons/{id}/guardian", personId).with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content(GUARDIAN_JSON))
                .andExpect(status().isConflict());

        when(guardianUseCase.update(any(), any(), any(), any(), any())).thenThrow(new ValidationException("Guardian needs an e-mail or a phone"));
        mockMvc.perform(put("/api/v1/persons/{id}/guardian", personId).with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content(GUARDIAN_JSON))
                .andExpect(status().isBadRequest());
    }

    @Test
    void theGuardianBodyIsValidatedBeforeTheUseCase() throws Exception {
        mockMvc.perform(post("/api/v1/persons/{id}/guardian", personId).with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(guardianUseCase);
    }

    @Test
    void readingAMinorWithoutGuardianIs404AndWithGuardianReturnsIt() throws Exception {
        when(guardianUseCase.find(eq(personId), any())).thenReturn(Optional.empty());
        mockMvc.perform(get("/api/v1/persons/{id}/guardian", personId).with(asAdmin())).andExpect(status().isNotFound());

        when(guardianUseCase.find(eq(personId), any())).thenReturn(Optional.of(guardian()));
        mockMvc.perform(get("/api/v1/persons/{id}/guardian", personId).with(asAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.relationship").value("Madre"));
    }

    @Test
    void editingTheGuardianAnswers200() throws Exception {
        when(guardianUseCase.update(eq(personId), any(), eq(caller), any(), eq("abc"))).thenReturn(guardian());

        mockMvc.perform(put("/api/v1/persons/{id}/guardian", personId).with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content(GUARDIAN_JSON))
                .andExpect(status().isOk());
    }

    private Guardian guardian() {
        Guardian g = new Guardian();
        g.setGuardianId(UUID.randomUUID());
        g.setMinorPersonId(personId);
        g.setFullName("Ana Gómez");
        g.setDocumentType("CC");
        g.setDocumentNumber("5005");
        g.setRelationship("Madre");
        g.setCreatedAt(LocalDateTime.now());
        g.setUpdatedAt(LocalDateTime.now());
        return g;
    }

    @Test
    void aMinorWhoseGuardianHasNoSignedDocumentIsToldTheDocumentIsPending() throws Exception {
        when(termsUseCase.enablement(eq(personId), any())).thenReturn(enablement(Enablement.Status.DOCUMENT_PENDING, true, true));

        mockMvc.perform(get("/api/v1/persons/{id}/terms", personId).with(asAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pendingStep").value("DOCUMENT"))
                .andExpect(jsonPath("$.enabled").value(false));
    }

    @Test
    void uploadingTheSignedDocumentAnswers201AndReportsItOnTheGuardian() throws Exception {
        Guardian saved = new Guardian();
        saved.setGuardianId(UUID.randomUUID());
        saved.setMinorPersonId(personId);
        saved.setConsentDocumentUri("guardian-documents/2026/10/a.pdf");
        saved.setConsentDocumentName("autorizacion.pdf");
        saved.setConsentDocumentUploadedAt(LocalDateTime.now());
        byte[] pdf = "%PDF-1.4 signed".getBytes();
        when(documentUseCase.upload(eq(personId), eq("autorizacion.pdf"), eq(pdf), any(), any())).thenReturn(saved);

        mockMvc.perform(multipart("/api/v1/persons/{id}/guardian/document", personId)
                        .file(new MockMultipartFile("file", "autorizacion.pdf", "application/pdf", pdf))
                        .with(asAdmin()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.documentRegistered").value(true))
                .andExpect(jsonPath("$.documentName").value("autorizacion.pdf"));
    }

    @Test
    void anEmptyFileIsRejectedBeforeTheUseCase() throws Exception {
        mockMvc.perform(multipart("/api/v1/persons/{id}/guardian/document", personId)
                        .file(new MockMultipartFile("file", "vacio.pdf", "application/pdf", new byte[0]))
                        .with(asAdmin()))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(documentUseCase);
    }

    @Test
    void theSignedDocumentIsDownloadedAsAnAttachmentWithoutSniffing() throws Exception {
        byte[] pdf = "%PDF-1.4 signed".getBytes();
        when(documentUseCase.download(eq(personId), any()))
                .thenReturn(new ManageGuardianDocumentUseCase.Document("autorizacion.pdf", "application/pdf", pdf));

        mockMvc.perform(get("/api/v1/persons/{id}/guardian/document", personId).with(asAdmin()))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")))
                .andExpect(content().bytes(pdf));
    }
}
