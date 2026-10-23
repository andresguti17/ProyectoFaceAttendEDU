package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.dto.OnboardSchoolRequest;
import com.faceattend_edu.identity_service.application.port.in.OnboardSchoolUseCase;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Public school sign-up. The school and its administrator are created pending activation. */
@RestController
@RequestMapping("/api/v1/onboarding")
@RequiredArgsConstructor
public class OnboardingController {

    private final OnboardSchoolUseCase onboardSchoolUseCase;

    @PostMapping("/schools")
    public ResponseEntity<Map<String, Object>> onboardSchool(@Valid @RequestBody OnboardSchoolRequest request) {
        OnboardSchoolRequest.SchoolPart s = request.getSchool();
        OnboardSchoolRequest.AdminPart a = request.getAdmin();
        var result = onboardSchoolUseCase.onboard(
                new OnboardSchoolUseCase.School(s.getCode().trim(), s.getName().trim(), s.getCityName(),
                        s.getAddress(), s.getPhone(), s.getEmail()),
                new OnboardSchoolUseCase.Admin(a.getDocumentType(), a.getDocumentNumber().trim(), a.getName().trim(),
                        a.getLastName().trim(), a.getEmail().trim(), a.getPhone(), a.getUsername().trim(), a.getPassword(),
                        a.getPrivacyPolicyVersion().trim(), Boolean.TRUE.equals(a.getBiometricAccepted())));
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of(
                "schoolId", result.schoolId(),
                "userId", result.userId(),
                "status", "PENDING_ACTIVATION"));
    }
}
