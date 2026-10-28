package com.faceattend_edu.identity_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/** One acceptance of the Terms and Conditions, kept for audit. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TermsAcceptance {

    public static final String ADULT = "ADULT";
    public static final String MINOR = "MINOR";
    public static final String BY_SELF = "SELF";
    public static final String BY_GUARDIAN = "GUARDIAN";

    private UUID acceptanceId;
    private UUID personId;
    private String termsVersion;
    private String userType;
    private String acceptedBy;
    private UUID guardianId;
    /** DataProcessingConsent.SELF (the holder) or ASSISTED (an administrator with the guardian present). */
    private String channel;
    private UUID recordedBy;
    private Long schoolId;
    private LocalDateTime acceptedAt;
}
