package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.mapper.PersonWebMapper;
import com.faceattend_edu.identity_service.application.port.in.UpdateOwnProfileUseCase;
import com.faceattend_edu.identity_service.application.port.in.UpdateOwnProfileUseCase.ProfileChanges;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.BloodType;
import com.faceattend_edu.identity_service.domain.model.Person;
import org.junit.jupiter.api.DisplayName;
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
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Cobertura HTTP (MockMvc) de {@code ProfileController}: PUT /api/v1/auth/me/profile. */
@WebMvcTest(controllers = ProfileController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(PersonWebMapper.class)
@DisplayName("ProfileController HTTP tests (MockMvc)")
class ProfileControllerTest {

    private static final String URL = "/api/v1/auth/me/profile";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UpdateOwnProfileUseCase updateOwnProfileUseCase;

    private Person updated() {
        Person person = new Person();
        person.setPersonId(UUID.randomUUID());
        person.setName("Ana");
        person.setLastName("Pérez");
        person.setDocumentNumber("123");
        person.setPhone("3111111111");
        person.setBloodType(BloodType.O_POSITIVE);
        person.setBirthDate(LocalDate.of(2000, 5, 17));
        return person;
    }

    @Test
    @DisplayName("200 with the updated person; the account comes from the session attribute")
    void updates() throws Exception {
        UUID caller = UUID.randomUUID();
        when(updateOwnProfileUseCase.updateProfile(any(UUID.class), any(ProfileChanges.class))).thenReturn(updated());

        mockMvc.perform(put(URL).requestAttr("X-User-Id", caller.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"3111111111\",\"bloodType\":\"O+\",\"birthDate\":\"2000-05-17\",\"email\":\"nueva@colegio.edu\",\"currentPassword\":\"Secret123!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phone").value("3111111111"))
                .andExpect(jsonPath("$.bloodType").value("O+"))
                .andExpect(jsonPath("$.name").value("Ana"));

        ArgumentCaptor<ProfileChanges> captor = ArgumentCaptor.forClass(ProfileChanges.class);
        verify(updateOwnProfileUseCase).updateProfile(org.mockito.ArgumentMatchers.eq(caller), captor.capture());
        assertEquals("nueva@colegio.edu", captor.getValue().email());
        assertEquals("Secret123!", captor.getValue().currentPassword());
        assertEquals(LocalDate.of(2000, 5, 17), captor.getValue().birthDate());
    }

    @Test
    @DisplayName("fields outside the editable set in the body are ignored")
    void ignoresForbiddenFields() throws Exception {
        UUID caller = UUID.randomUUID();
        when(updateOwnProfileUseCase.updateProfile(any(UUID.class), any(ProfileChanges.class))).thenReturn(updated());

        mockMvc.perform(put(URL).requestAttr("X-User-Id", caller.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"3111111111\",\"name\":\"Hacker\",\"documentNumber\":\"999\",\"status\":false}"))
                .andExpect(status().isOk());

        ArgumentCaptor<ProfileChanges> captor = ArgumentCaptor.forClass(ProfileChanges.class);
        verify(updateOwnProfileUseCase).updateProfile(org.mockito.ArgumentMatchers.eq(caller), captor.capture());
        assertEquals("3111111111", captor.getValue().phone());
    }

    @Test
    @DisplayName("401 without a session user")
    void unauthorized() throws Exception {
        mockMvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        verify(updateOwnProfileUseCase, never()).updateProfile(any(), any());
    }

    @Test
    @DisplayName("400 for an unknown blood type or a malformed email")
    void validation() throws Exception {
        UUID caller = UUID.randomUUID();
        mockMvc.perform(put(URL).requestAttr("X-User-Id", caller.toString())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"bloodType\":\"Z+\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put(URL).requestAttr("X-User-Id", caller.toString())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"no-es-correo\"}"))
                .andExpect(status().isBadRequest());
        verify(updateOwnProfileUseCase, never()).updateProfile(any(), any());
    }

    @Test
    @DisplayName("400 when the use case rejects the change (wrong current password)")
    void wrongPassword() throws Exception {
        UUID caller = UUID.randomUUID();
        when(updateOwnProfileUseCase.updateProfile(any(UUID.class), any(ProfileChanges.class)))
                .thenThrow(new ValidationException("Current password is incorrect"));

        mockMvc.perform(put(URL).requestAttr("X-User-Id", caller.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nueva@colegio.edu\",\"currentPassword\":\"mala\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Current password is incorrect"));
    }
}
