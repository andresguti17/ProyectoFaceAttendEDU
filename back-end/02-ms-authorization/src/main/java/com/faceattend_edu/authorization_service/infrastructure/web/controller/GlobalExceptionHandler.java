package com.faceattend_edu.authorization_service.infrastructure.web.controller;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.exception.ValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * ISO/IEC 9001 — Enhanced Exception Handler (Cláusula 10.2 / 8.2)
 * Authorization Service
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger errorLog = LoggerFactory.getLogger("QUALITY_ERROR");

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(EntityNotFoundException ex) {
        return buildErrorResponse(HttpStatus.NOT_FOUND, "ISO-8.5-INT-001", ex.getMessage(), "8.5", "WARNING");
    }

    @ExceptionHandler(DuplicateEntityException.class)
    public ResponseEntity<Map<String, Object>> handleDuplicate(DuplicateEntityException ex) {
        return buildErrorResponse(HttpStatus.CONFLICT, "ISO-8.5-DUP-001", ex.getMessage(), "8.5", "WARNING");
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(ValidationException ex) {
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "ISO-8.2-VAL-001", ex.getMessage(), "8.2", "WARNING");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegal(IllegalArgumentException ex) {
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "ISO-8.2-VAL-001", ex.getMessage(), "8.2", "WARNING");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleBeanValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .reduce((a, b) -> a + ", " + b).orElse(ex.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "ISO-8.2-VAL-002", msg, "8.2", "WARNING");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadableBody(HttpMessageNotReadableException ex) {
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "ISO-8.2-VAL-002",
            "Malformed request body", "8.2", "WARNING");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "ISO-8.2-VAL-002",
            "Invalid value for parameter '" + ex.getName() + "'", "8.2", "WARNING");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(DataIntegrityViolationException ex) {
        // Deleting a role/permission still referenced by role_permission or user_role
        // hits this FK constraint (intra-context, per AGENTS.md section 2.1) instead
        // of a clean delete — surface it as a conflict, not a 500.
        return buildErrorResponse(HttpStatus.CONFLICT, "ISO-8.5-DUP-002",
            "This resource is still referenced by another record and cannot be deleted", "8.5", "WARNING");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        errorLog.error("Unhandled exception: {}", ex.getMessage(), ex);
        return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "ISO-10.2-NC-001",
            "Internal server error", "10.2", "CRITICAL");
    }

    private ResponseEntity<Map<String, Object>> buildErrorResponse(
            HttpStatus status, String isoCode, String message, String isoClause, String severity) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", isoCode); error.put("message", message);
        error.put("correlationId", UUID.randomUUID().toString());
        error.put("timestamp", Instant.now().toString());
        error.put("isoClause", isoClause); error.put("severity", severity);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("error", error);

        errorLog.error("ISO9001_ERROR code={} status={} clause={} severity={} message={}",
            isoCode, status.value(), isoClause, severity, message);

        return ResponseEntity.status(status).body(response);
    }
}
