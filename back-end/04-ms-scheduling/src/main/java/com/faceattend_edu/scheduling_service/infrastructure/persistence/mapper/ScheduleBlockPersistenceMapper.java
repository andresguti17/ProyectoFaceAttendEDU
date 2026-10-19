package com.faceattend_edu.scheduling_service.infrastructure.persistence.mapper;

import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.entity.ScheduleBlockJpaEntity;
import org.springframework.stereotype.Component;

@Component
public class ScheduleBlockPersistenceMapper {
    public ScheduleBlock toDomain(ScheduleBlockJpaEntity e) {
        if (e == null) return null;
        ScheduleBlock d = new ScheduleBlock();
        d.setScheduleBlockId(e.getScheduleBlockId());
        d.setCohortId(e.getCohortId());
        d.setCourseId(e.getCourseId());
        d.setEnvironmentId(e.getEnvironmentId());
        d.setInstructorActorId(e.getInstructorActorId());
        d.setDayOfWeek(e.getDayOfWeek());
        d.setStartsAt(e.getStartsAt());
        d.setEndsAt(e.getEndsAt());
        d.setCreatedAt(e.getCreatedAt());
        d.setUpdatedAt(e.getUpdatedAt());
        d.setDeletedAt(e.getDeletedAt());
        d.setCreatedBy(e.getCreatedBy());
        d.setUpdatedBy(e.getUpdatedBy());
        d.setDeletedBy(e.getDeletedBy());
        d.setRowVersion(e.getRowVersion());
        return d;
    }
    public ScheduleBlockJpaEntity toEntity(ScheduleBlock d) {
        if (d == null) return null;
        ScheduleBlockJpaEntity e = new ScheduleBlockJpaEntity();
        e.setScheduleBlockId(d.getScheduleBlockId());
        e.setCohortId(d.getCohortId());
        e.setCourseId(d.getCourseId());
        e.setEnvironmentId(d.getEnvironmentId());
        e.setInstructorActorId(d.getInstructorActorId());
        e.setDayOfWeek(d.getDayOfWeek());
        e.setStartsAt(d.getStartsAt());
        e.setEndsAt(d.getEndsAt());
        e.setCreatedAt(d.getCreatedAt());
        e.setUpdatedAt(d.getUpdatedAt());
        e.setDeletedAt(d.getDeletedAt());
        e.setCreatedBy(d.getCreatedBy());
        e.setUpdatedBy(d.getUpdatedBy());
        e.setDeletedBy(d.getDeletedBy());
        e.setRowVersion(d.getRowVersion());
        return e;
    }
}
