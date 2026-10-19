package com.faceattend_edu.scheduling_service.infrastructure.web.dto;

import lombok.Data;
import java.time.Instant;
import java.time.LocalTime;

@Data
public class ScheduleBlockResponse {
    private Long scheduleBlockId;
    private Long cohortId;
    private Integer courseId;
    private Integer environmentId;
    private Long instructorActorId;
    private Short dayOfWeek;
    private LocalTime startsAt;
    private LocalTime endsAt;
    private Instant createdAt;
    private Instant updatedAt;
    private long rowVersion;
}
