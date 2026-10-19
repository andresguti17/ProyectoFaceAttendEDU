package com.faceattend_edu.authorization_service.infrastructure.web.controller;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void mapsForeignKeyViolationsToConflictInsteadOfServerError() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleDataIntegrity(new DataIntegrityViolationException("fk_user_role_role"));

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> error = (Map<String, Object>) response.getBody().get("error");
        assertEquals("ISO-8.5-DUP-002", error.get("code"));
    }
}
