package com.faceattend_edu.scheduling_service.infrastructure.web.controller;

import com.faceattend_edu.scheduling_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.exception.ValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger errorLog = LoggerFactory.getLogger("QUALITY_ERROR");

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<Map<String,String>> handleNotFound(EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
    }
    @ExceptionHandler(DuplicateEntityException.class)
    public ResponseEntity<Map<String,String>> handleDuplicate(DuplicateEntityException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String,String>> handleDataIntegrity(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Data integrity violation: " + ex.getMostSpecificCause().getMessage()));
    }
    // A concurrent writer bumped row_version first: that is a client-retryable conflict,
    // not an internal failure, so it must not fall through to the generic 500 handler.
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<Map<String,String>> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "The record changed since it was read; reload it and retry"));
    }
    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<Map<String,String>> handleValidation(ValidationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
    }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,String>> handleIllegal(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String,String>> handleBeanValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .reduce((a,b)->a+", "+b).orElse(ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", msg));
    }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String,String>> handleUnreadableBody(HttpMessageNotReadableException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Malformed request body"));
    }
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String,String>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "Invalid value for parameter '" + ex.getName() + "'"));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,String>> handleGeneric(Exception ex) {
        errorLog.error("Unhandled exception: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Internal server error"));
    }
}
