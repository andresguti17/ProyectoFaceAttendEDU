package com.faceattend_edu.identity_service.adapter.in.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Body of POST /api/v1/onboarding/schools: the school plus its first administrator. */
@Data
public class OnboardSchoolRequest {

    @Valid
    @NotNull(message = "school is required")
    private SchoolPart school;

    @Valid
    @NotNull(message = "admin is required")
    private AdminPart admin;

    @Data
    public static class SchoolPart {
        @NotBlank @Size(max = 50)
        private String code;
        @NotBlank @Size(max = 255)
        private String name;
        @Size(max = 100)
        private String cityName;
        @Size(max = 255)
        private String address;
        @Size(max = 50)
        private String phone;
        @Email @Size(max = 255)
        private String email;
    }

    @Data
    public static class AdminPart {
        @NotBlank @Pattern(regexp = "CC|TI|CE|PP", message = "must be one of CC, TI, CE, PP")
        private String documentType;
        @NotBlank @Size(max = 50)
        private String documentNumber;
        @NotBlank @Size(max = 255)
        private String name;
        @NotBlank @Size(max = 255)
        private String lastName;
        @NotBlank @Email @Size(max = 255)
        private String email;
        @Size(max = 50)
        private String phone;
        @NotBlank @Size(min = 3, max = 255)
        private String username;
        @NotBlank @Size(min = 8, max = 100)
        private String password;
        /** Version of the privacy notice the administrator accepted (Ley 1581). */
        @NotBlank @Size(max = 20)
        private String privacyPolicyVersion;
        /** Optional authorization to process their biometric data (art. 6-a). */
        private Boolean biometricAccepted;
    }
}
