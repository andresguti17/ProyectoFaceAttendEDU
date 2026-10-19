package com.faceattend_edu.authorization_service.infrastructure.web.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {
    @GetMapping({"/health", "/api/v1/health", "/api/health"})
    public ResponseEntity<Map<String,String>> health() {
        return ResponseEntity.ok(Map.of("status","UP","service","authorization-service"));
    }
}
