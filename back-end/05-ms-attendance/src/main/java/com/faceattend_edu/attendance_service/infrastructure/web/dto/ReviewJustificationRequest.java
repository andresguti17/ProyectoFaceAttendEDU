package com.faceattend_edu.attendance_service.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.UUID;

@Data
public class ReviewJustificationRequest {
    @NotBlank private String reviewStatus;
    /** Ignored: the reviewer is taken from the session. Kept so older clients still deserialize. */
    private UUID reviewedBy;
    private String resolutionNotes;
}
