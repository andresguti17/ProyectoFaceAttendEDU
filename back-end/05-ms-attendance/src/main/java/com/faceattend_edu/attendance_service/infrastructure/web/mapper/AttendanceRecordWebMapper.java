package com.faceattend_edu.attendance_service.infrastructure.web.mapper;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.AttendanceRecordResponse;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.CreateAttendanceRecordRequest;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.UpdateAttendanceRecordRequest;
import org.springframework.stereotype.Component;

@Component
public class AttendanceRecordWebMapper {
    public AttendanceRecord toDomain(CreateAttendanceRecordRequest req){
        if(req==null) return null;
        AttendanceRecord d=new AttendanceRecord();
        d.setClassSessionId(req.getClassSessionId());
        d.setAcademicActorId(req.getAcademicActorId());
        d.setAttendanceStatus(req.getAttendanceStatus());
        d.setCaptureMethod(req.getCaptureMethod());
        d.setMatchScore(req.getMatchScore());
        return d;
    }
    public AttendanceRecord toDomain(UpdateAttendanceRecordRequest req){
        if(req==null) return null;
        AttendanceRecord d=new AttendanceRecord();
        d.setAttendanceStatus(req.getAttendanceStatus());
        d.setCaptureMethod(req.getCaptureMethod());
        d.setMatchScore(req.getMatchScore());
        d.setCapturedAt(req.getCapturedAt());
        return d;
    }
    public AttendanceRecordResponse toResponse(AttendanceRecord d){
        if(d==null) return null;
        AttendanceRecordResponse r=new AttendanceRecordResponse();
        r.setAttendanceRecordId(d.getAttendanceRecordId());
        r.setClassSessionId(d.getClassSessionId());
        r.setAcademicActorId(d.getAcademicActorId());
        r.setAttendanceStatus(d.getAttendanceStatus());
        r.setCaptureMethod(d.getCaptureMethod());
        r.setCapturedAt(d.getCapturedAt());
        r.setMatchScore(d.getMatchScore());
        r.setCreatedAt(d.getCreatedAt());
        r.setRowVersion(d.getRowVersion());
        return r;
    }
}
