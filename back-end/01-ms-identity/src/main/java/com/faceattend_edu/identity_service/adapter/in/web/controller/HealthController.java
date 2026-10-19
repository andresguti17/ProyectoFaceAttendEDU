package com.faceattend_edu.identity_service.adapter.in.web.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {

    private final long startedAt = System.currentTimeMillis();

    @GetMapping({"/health", "/api/v1/health", "/api/health"})
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "identity-service",
                "version", "0.0.1-SNAPSHOT",
                "uptimeSeconds", (System.currentTimeMillis() - startedAt) / 1000,
                "timestamp", java.time.Instant.now().toString()));
    }
}
