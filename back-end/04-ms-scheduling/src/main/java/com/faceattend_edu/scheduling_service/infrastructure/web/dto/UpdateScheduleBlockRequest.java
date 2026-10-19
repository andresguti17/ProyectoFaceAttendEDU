package com.faceattend_edu.scheduling_service.infrastructure.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;
import java.time.LocalTime;

@Data
public class UpdateScheduleBlockRequest {
    private Long cohortId;
    private Integer courseId;
    private Integer environmentId;
    private Long instructorActorId;
    @Min(1) @Max(7) private Short dayOfWeek;
    private LocalTime startsAt;
    private LocalTime endsAt;
}
