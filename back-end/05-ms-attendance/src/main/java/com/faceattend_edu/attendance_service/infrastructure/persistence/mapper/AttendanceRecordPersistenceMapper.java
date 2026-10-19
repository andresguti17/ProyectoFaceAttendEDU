package com.faceattend_edu.attendance_service.infrastructure.persistence.mapper;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.AttendanceRecordJpaEntity;
import org.springframework.stereotype.Component;

@Component
public class AttendanceRecordPersistenceMapper {
    public AttendanceRecord toDomain(AttendanceRecordJpaEntity e){
        if(e==null) return null;
        AttendanceRecord d=new AttendanceRecord();
        d.setAttendanceRecordId(e.getAttendanceRecordId());
        d.setClassSessionId(e.getClassSessionId());
        d.setAcademicActorId(e.getAcademicActorId());
        d.setAttendanceStatus(e.getAttendanceStatus());
        d.setCaptureMethod(e.getCaptureMethod());
        d.setCapturedAt(e.getCapturedAt());
        d.setMatchScore(e.getMatchScore());
        d.setCreatedAt(e.getCreatedAt());
        d.setUpdatedAt(e.getUpdatedAt());
        d.setDeletedAt(e.getDeletedAt());
        d.setCreatedBy(e.getCreatedBy());
        d.setUpdatedBy(e.getUpdatedBy());
        d.setDeletedBy(e.getDeletedBy());
        d.setRowVersion(e.getRowVersion());
        return d;
    }
    public AttendanceRecordJpaEntity toEntity(AttendanceRecord d){
        if(d==null) return null;
        AttendanceRecordJpaEntity e=new AttendanceRecordJpaEntity();
        e.setAttendanceRecordId(d.getAttendanceRecordId());
        e.setClassSessionId(d.getClassSessionId());
        e.setAcademicActorId(d.getAcademicActorId());
        e.setAttendanceStatus(d.getAttendanceStatus());
        e.setCaptureMethod(d.getCaptureMethod());
        e.setCapturedAt(d.getCapturedAt());
        e.setMatchScore(d.getMatchScore());
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
