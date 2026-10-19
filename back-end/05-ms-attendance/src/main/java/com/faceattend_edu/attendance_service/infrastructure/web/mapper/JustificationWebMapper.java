package com.faceattend_edu.attendance_service.infrastructure.web.mapper;

import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.CreateJustificationRequest;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.JustificationResponse;
import org.springframework.stereotype.Component;

@Component
public class JustificationWebMapper {
    public Justification toDomain(CreateJustificationRequest req){
        if(req==null) return null;
        Justification j=new Justification();
        j.setAttendanceRecordId(req.getAttendanceRecordId());
        j.setJustificationTypeId(req.getJustificationTypeId());
        j.setReason(req.getReason());
        return j;
    }
    public JustificationResponse toResponse(Justification d){
        if(d==null) return null;
        JustificationResponse r=new JustificationResponse();
        r.setJustificationId(d.getJustificationId());
        r.setAttendanceRecordId(d.getAttendanceRecordId());
        r.setJustificationTypeId(d.getJustificationTypeId());
        r.setReason(d.getReason());
        r.setSubmittedAt(d.getSubmittedAt());
        r.setReviewedBy(d.getReviewedBy());
        r.setReviewedAt(d.getReviewedAt());
        r.setReviewStatus(d.getReviewStatus());
        r.setResolutionNotes(d.getResolutionNotes());
        r.setCreatedAt(d.getCreatedAt());
        r.setRowVersion(d.getRowVersion());
        return r;
    }
}
