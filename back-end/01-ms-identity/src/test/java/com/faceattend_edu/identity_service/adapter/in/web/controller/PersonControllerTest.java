package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.mapper.PersonWebMapper;
import com.faceattend_edu.identity_service.application.port.in.ChangePersonStatusUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreatePersonUseCase;
import com.faceattend_edu.identity_service.application.port.in.GetPersonUseCase;
import com.faceattend_edu.identity_service.application.port.in.ListPersonsUseCase;
import com.faceattend_edu.identity_service.application.port.in.UpdatePersonUseCase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.sql.SQLException;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = PersonController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(PersonWebMapper.class)
class PersonControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CreatePersonUseCase createPersonUseCase;
    @MockitoBean
    private GetPersonUseCase getPersonUseCase;
    @MockitoBean
    private ListPersonsUseCase listPersonsUseCase;
    @MockitoBean
    private UpdatePersonUseCase updatePersonUseCase;
    @MockitoBean
    private ChangePersonStatusUseCase changePersonStatusUseCase;

    private static String body(String documentType, String name) {
        return "{\"documentNumber\":\"123\",\"name\":\"" + name + "\",\"lastName\":\"Perez\",\"documentType\":\""
                + documentType + "\"}";
    }

    @Test
    void unknownDocumentTypeIsRejectedWith400() throws Exception {
        mockMvc.perform(post("/api/v1/persons").contentType(MediaType.APPLICATION_JSON).content(body("XX", "Ana")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        verifyNoInteractions(createPersonUseCase);
    }

    @Test
    void textPlainBodyIs415NotAnInternalError() throws Exception {
        mockMvc.perform(post("/api/v1/persons").contentType(MediaType.TEXT_PLAIN).content("hola"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error").value("UNSUPPORTED_MEDIA_TYPE"));
    }

    @Test
    void oversizedNameIs400() throws Exception {
        mockMvc.perform(post("/api/v1/persons").contentType(MediaType.APPLICATION_JSON)
                        .content(body("CC", "a".repeat(10_000))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void valueTooLongFromTheDatabaseIs400ButUniquenessIs409() throws Exception {
        when(createPersonUseCase.createPerson(any()))
                .thenThrow(new DataIntegrityViolationException("x", new SQLException("too long", "22001")))
                .thenThrow(new DataIntegrityViolationException("x", new SQLException("dup", "23505")));
        mockMvc.perform(post("/api/v1/persons").contentType(MediaType.APPLICATION_JSON).content(body("CC", "Ana")))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/persons").contentType(MediaType.APPLICATION_JSON).content(body("CC", "Ana")))
                .andExpect(status().isConflict());
    }
}
