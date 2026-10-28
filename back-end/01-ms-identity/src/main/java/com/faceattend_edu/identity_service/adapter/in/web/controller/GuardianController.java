package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.application.port.in.ManageGuardianUseCase;
import com.faceattend_edu.identity_service.application.port.in.ManageGuardianUseCase.GuardianData;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.Guardian;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Guardian (acudiente) of a minor learner. Only school administrators register, edit and read it:
 * it is personal data of third parties linked to a minor (Ley 1581 art. 7).
 */
@RestController
@RequestMapping("/api/v1/persons/{minorId}/guardian")
@RequiredArgsConstructor
public class GuardianController {

    private final ManageGuardianUseCase guardianUseCase;

    @Data
    public static class GuardianRequest {
        @NotBlank @Size(max = 255)
        private String fullName;
        @NotBlank @Size(max = 10)
        private String documentType;
        @NotBlank @Size(max = 50)
        private String documentNumber;
        @Size(max = 255)
        private String email;
        @Size(max = 50)
        private String phone;
        @NotBlank @Size(max = 30)
        private String relationship;

        GuardianData toData() {
            return new GuardianData(fullName, documentType, documentNumber, email, phone, relationship);
        }
    }

    public record GuardianResponse(UUID guardianId, UUID minorPersonId, String fullName, String documentType,
                                   String documentNumber, String email, String phone, String relationship,
                                   Long schoolId, LocalDateTime createdAt, LocalDateTime updatedAt) {

        static GuardianResponse of(Guardian g) {
            return new GuardianResponse(g.getGuardianId(), g.getMinorPersonId(), g.getFullName(), g.getDocumentType(),
                    g.getDocumentNumber(), g.getEmail(), g.getPhone(), g.getRelationship(), g.getSchoolId(),
                    g.getCreatedAt(), g.getUpdatedAt());
        }
    }

    @GetMapping
    public ResponseEntity<GuardianResponse> get(@PathVariable UUID minorId, HttpServletRequest http) {
        Guardian guardian = guardianUseCase.find(minorId, TermsController.roles(http))
                .orElseThrow(() -> new EntityNotFoundException("Guardian", minorId));
        return ResponseEntity.ok(GuardianResponse.of(guardian));
    }

    @PostMapping
    public ResponseEntity<GuardianResponse> register(@PathVariable UUID minorId, @Valid @RequestBody GuardianRequest body,
                                                     HttpServletRequest http) {
        Guardian saved = guardianUseCase.register(minorId, body.toData(), TermsController.caller(http),
                TermsController.roles(http), TermsController.bearer(http));
        return ResponseEntity.status(HttpStatus.CREATED).body(GuardianResponse.of(saved));
    }

    @PutMapping
    public ResponseEntity<GuardianResponse> update(@PathVariable UUID minorId, @Valid @RequestBody GuardianRequest body,
                                                   HttpServletRequest http) {
        Guardian saved = guardianUseCase.update(minorId, body.toData(), TermsController.caller(http),
                TermsController.roles(http), TermsController.bearer(http));
        return ResponseEntity.ok(GuardianResponse.of(saved));
    }
}
