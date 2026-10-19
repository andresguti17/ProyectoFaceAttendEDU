package com.faceattend_edu.scheduling_service.infrastructure.web.mapper;

import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.CreateScheduleBlockRequest;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.ScheduleBlockResponse;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.UpdateScheduleBlockRequest;
import org.springframework.stereotype.Component;

@Component
public class ScheduleBlockWebMapper {
    public ScheduleBlock toDomain(CreateScheduleBlockRequest req) {
        if (req == null) return null;
        ScheduleBlock b = new ScheduleBlock();
        b.setCohortId(req.getCohortId());
        b.setCourseId(req.getCourseId());
        b.setEnvironmentId(req.getEnvironmentId());
        b.setInstructorActorId(req.getInstructorActorId());
        b.setDayOfWeek(req.getDayOfWeek());
        b.setStartsAt(req.getStartsAt());
        b.setEndsAt(req.getEndsAt());
        return b;
    }
    public ScheduleBlock toDomain(UpdateScheduleBlockRequest req) {
        if (req == null) return null;
        ScheduleBlock b = new ScheduleBlock();
        b.setCohortId(req.getCohortId());
        b.setCourseId(req.getCourseId());
        b.setEnvironmentId(req.getEnvironmentId());
        b.setInstructorActorId(req.getInstructorActorId());
        b.setDayOfWeek(req.getDayOfWeek());
        b.setStartsAt(req.getStartsAt());
        b.setEndsAt(req.getEndsAt());
        return b;
    }
    public ScheduleBlockResponse toResponse(ScheduleBlock d) {
        if (d == null) return null;
        ScheduleBlockResponse r = new ScheduleBlockResponse();
        r.setScheduleBlockId(d.getScheduleBlockId());
        r.setCohortId(d.getCohortId());
        r.setCourseId(d.getCourseId());
        r.setEnvironmentId(d.getEnvironmentId());
        r.setInstructorActorId(d.getInstructorActorId());
        r.setDayOfWeek(d.getDayOfWeek());
        r.setStartsAt(d.getStartsAt());
        r.setEndsAt(d.getEndsAt());
        r.setCreatedAt(d.getCreatedAt());
        r.setUpdatedAt(d.getUpdatedAt());
        r.setRowVersion(d.getRowVersion());
        return r;
    }
}
