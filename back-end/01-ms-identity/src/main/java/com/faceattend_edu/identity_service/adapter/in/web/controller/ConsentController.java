package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.application.port.in.ManageConsentUseCase;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.model.DataProcessingConsent;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Data-processing authorization of a person (Ley 1581 de 2012): read it, accept the
 * privacy notice in force (with the optional biometric part) and revoke the biometric part.
 */
@RestController
@RequestMapping("/api/v1/persons/{personId}/consent")
@RequiredArgsConstructor
public class ConsentController {

    private final ManageConsentUseCase consentUseCase;

    @Data
    public static class AcceptConsentRequest {
        @NotBlank
        private String policyVersion;
        private Boolean biometricAccepted;
    }

    public record ConsentResponse(UUID personId, String currentPolicyVersion, boolean accepted, boolean upToDate,
                                  String policyVersion, LocalDateTime acceptedAt, boolean biometricAuthorized,
                                  LocalDateTime biometricRevokedAt, String channel) {

        static ConsentResponse of(UUID personId, String current, DataProcessingConsent c) {
            if (c == null) return new ConsentResponse(personId, current, false, false, null, null, false, null, null);
            return new ConsentResponse(personId, current, true, current.equals(c.getPolicyVersion()), c.getPolicyVersion(),
                    c.getAcceptedAt(), c.biometricAuthorized(), c.getBiometricRevokedAt(), c.getChannel());
        }
    }

    @GetMapping
    public ResponseEntity<ConsentResponse> get(@PathVariable UUID personId, HttpServletRequest http) {
        DataProcessingConsent current = consentUseCase.current(personId, caller(http), roles(http)).orElse(null);
        return ResponseEntity.ok(ConsentResponse.of(personId, consentUseCase.currentPolicyVersion(), current));
    }

    @PostMapping
    public ResponseEntity<ConsentResponse> accept(@PathVariable UUID personId, @Valid @RequestBody AcceptConsentRequest body,
                                                  HttpServletRequest http) {
        DataProcessingConsent saved = consentUseCase.accept(personId, body.getPolicyVersion(),
                Boolean.TRUE.equals(body.getBiometricAccepted()), caller(http), roles(http));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ConsentResponse.of(personId, consentUseCase.currentPolicyVersion(), saved));
    }

    @DeleteMapping("/biometric")
    public ResponseEntity<ConsentResponse> revokeBiometric(@PathVariable UUID personId, HttpServletRequest http) {
        DataProcessingConsent saved = consentUseCase.revokeBiometric(personId, caller(http), roles(http));
        return ResponseEntity.ok(ConsentResponse.of(personId, consentUseCase.currentPolicyVersion(), saved));
    }

    private static UUID caller(HttpServletRequest http) {
        Object caller = http.getAttribute("X-User-Id");
        if (caller == null) throw new UnauthorizedException("Authentication required");
        return UUID.fromString(String.valueOf(caller));
    }

    @SuppressWarnings("unchecked")
    private static Collection<String> roles(HttpServletRequest http) {
        Object roles = http.getAttribute("X-User-Roles");
        return roles instanceof Collection<?> c ? (Collection<String>) c : List.of();
    }
}
