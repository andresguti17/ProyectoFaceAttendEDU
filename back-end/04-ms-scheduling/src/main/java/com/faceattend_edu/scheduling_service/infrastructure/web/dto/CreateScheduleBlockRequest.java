package com.faceattend_edu.scheduling_service.infrastructure.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalTime;

@Data
public class CreateScheduleBlockRequest {
    @NotNull private Long cohortId;
    @NotNull private Integer courseId;
    @NotNull private Integer environmentId;
    @NotNull private Long instructorActorId;
    @NotNull @Min(1) @Max(7) private Short dayOfWeek;
    @NotNull private LocalTime startsAt;
    @NotNull private LocalTime endsAt;
}
