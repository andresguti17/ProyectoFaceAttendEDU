package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.application.port.in.ManageTermsUseCase;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.model.Enablement;
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
 * Terms and Conditions of a person: read whether they are enabled (terms accepted and, for a minor,
 * guardian registered) and record the acceptance. An adult accepts for themself; for a minor the
 * school administrator records the acceptance of the guardian, who is present at the school.
 */
@RestController
@RequestMapping("/api/v1/persons/{personId}/terms")
@RequiredArgsConstructor
public class TermsController {

    private final ManageTermsUseCase termsUseCase;

    @Data
    public static class AcceptTermsRequest {
        @NotBlank
        private String termsVersion;
    }

    /** pendingStep: NONE, GUARDIAN, DOCUMENT or TERMS, so the clients show which step is missing. */
    public record EnablementResponse(UUID personId, boolean minor, boolean guardianRegistered, boolean termsAccepted,
                                     boolean termsUpToDate, String acceptedVersion, LocalDateTime acceptedAt,
                                     String currentTermsVersion, String status, String pendingStep, boolean enabled) {

        static EnablementResponse of(Enablement e) {
            String step = switch (e.status()) {
                case ENABLED -> "NONE";
                case GUARDIAN_PENDING -> "GUARDIAN";
                case DOCUMENT_PENDING -> "DOCUMENT";
                case TERMS_PENDING -> "TERMS";
            };
            return new EnablementResponse(e.personId(), e.minor(), e.guardianRegistered(), e.termsAccepted(),
                    e.termsUpToDate(), e.acceptedVersion(), e.acceptedAt(), e.currentTermsVersion(),
                    e.status().name(), step, e.enabled());
        }
    }

    @GetMapping
    public ResponseEntity<EnablementResponse> get(@PathVariable UUID personId, HttpServletRequest http) {
        return ResponseEntity.ok(EnablementResponse.of(termsUseCase.enablement(personId, caller(http))));
    }

    @PostMapping
    public ResponseEntity<EnablementResponse> accept(@PathVariable UUID personId, @Valid @RequestBody AcceptTermsRequest body,
                                                     HttpServletRequest http) {
        Enablement result = termsUseCase.accept(personId, body.getTermsVersion(), caller(http), roles(http), bearer(http));
        return ResponseEntity.status(HttpStatus.CREATED).body(EnablementResponse.of(result));
    }

    static UUID caller(HttpServletRequest http) {
        Object caller = http.getAttribute("X-User-Id");
        if (caller == null) throw new UnauthorizedException("Authentication required");
        return UUID.fromString(String.valueOf(caller));
    }

    @SuppressWarnings("unchecked")
    static Collection<String> roles(HttpServletRequest http) {
        Object roles = http.getAttribute("X-User-Roles");
        return roles instanceof Collection<?> c ? (Collection<String>) c : List.of();
    }

    static String bearer(HttpServletRequest http) {
        String header = http.getHeader("Authorization");
        return header != null && header.regionMatches(true, 0, "Bearer ", 0, 7) ? header.substring(7).trim() : null;
    }
}
