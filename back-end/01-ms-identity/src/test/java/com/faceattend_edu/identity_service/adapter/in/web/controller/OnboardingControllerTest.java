package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.application.port.in.OnboardSchoolUseCase;
import com.faceattend_edu.identity_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.identity_service.domain.exception.OnboardingUnavailableException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Cobertura HTTP (MockMvc) de {@code OnboardingController}: alta pública de sede + administrador. */
@WebMvcTest(controllers = OnboardingController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("OnboardingController HTTP tests (MockMvc)")
class OnboardingControllerTest {

    private static final String URL = "/api/v1/onboarding/schools";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OnboardSchoolUseCase onboardSchoolUseCase;

    private static String body(String schoolCode, String documentType) {
        return """
                {"school":{"code":"%s","name":"Colegio Nuevo","cityName":"Bogotá","address":"Calle 1","phone":"3000000000","email":"sede@colegio.edu"},
                 "admin":{"documentType":"%s","documentNumber":"123456","name":"Ana","lastName":"Pérez",
                          "email":"ana@colegio.edu","phone":"3111111111","username":"ana.perez","password":"Secret123!","privacyPolicyVersion":"2026-11"}}
                """.formatted(schoolCode, documentType);
    }

    @Test
    @DisplayName("202 with the pending-activation payload")
    void accepted() throws Exception {
        UUID userId = UUID.randomUUID();
        when(onboardSchoolUseCase.onboard(any(), any()))
                .thenReturn(new OnboardSchoolUseCase.Result(7L, UUID.randomUUID(), userId));

        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body("CIES-009", "CC")))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.schoolId").value(7))
                .andExpect(jsonPath("$.userId").value(userId.toString()))
                .andExpect(jsonPath("$.status").value("PENDING_ACTIVATION"));
    }

    @Test
    @DisplayName("400 when the document type is outside CC/TI/CE/PP")
    void invalidDocumentType() throws Exception {
        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body("CIES-009", "XX")))
                .andExpect(status().isBadRequest());

        verify(onboardSchoolUseCase, never()).onboard(any(), any());
    }

    @Test
    @DisplayName("400 when the admin block is missing")
    void missingAdmin() throws Exception {
        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"school\":{\"code\":\"X\",\"name\":\"Y\"}}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("409 when the school code or username already exists")
    void conflict() throws Exception {
        when(onboardSchoolUseCase.onboard(any(), any())).thenThrow(new DuplicateEntityException("School", "CIES-009"));

        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body("CIES-009", "CC")))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("503 when the sign-up is disabled or a downstream service fails")
    void unavailable() throws Exception {
        when(onboardSchoolUseCase.onboard(any(), any())).thenThrow(new OnboardingUnavailableException("off"));

        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body("CIES-009", "CC")))
                .andExpect(status().isServiceUnavailable());
    }
}
