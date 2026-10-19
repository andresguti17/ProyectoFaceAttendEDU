package com.faceattend_edu.scheduling_service.infrastructure.web.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class UpdateClassSessionRequest {
    private Long scheduleBlockId;
    private LocalDate sessionDate;
    private String sessionStatus;
}
