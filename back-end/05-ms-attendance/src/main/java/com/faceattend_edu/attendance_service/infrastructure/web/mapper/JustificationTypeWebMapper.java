package com.faceattend_edu.attendance_service.infrastructure.web.mapper;

import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.CreateJustificationTypeRequest;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.JustificationTypeResponse;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.UpdateJustificationTypeRequest;
import org.springframework.stereotype.Component;

@Component
public class JustificationTypeWebMapper {
    public JustificationType toDomain(CreateJustificationTypeRequest req){
        if(req==null) return null;
        JustificationType d=new JustificationType();
        d.setSchoolId(req.getSchoolId());
        d.setName(req.getName());
        d.setDescription(req.getDescription());
        d.setRequiresAttachment(req.getRequiresAttachment());
        d.setStatus(req.getStatus());
        return d;
    }
    public JustificationType toDomain(UpdateJustificationTypeRequest req){
        if(req==null) return null;
        JustificationType d=new JustificationType();
        d.setSchoolId(req.getSchoolId());
        d.setName(req.getName());
        d.setDescription(req.getDescription());
        d.setRequiresAttachment(req.getRequiresAttachment());
        d.setStatus(req.getStatus());
        return d;
    }
    public JustificationTypeResponse toResponse(JustificationType d){
        if(d==null) return null;
        JustificationTypeResponse r=new JustificationTypeResponse();
        r.setJustificationTypeId(d.getJustificationTypeId());
        r.setSchoolId(d.getSchoolId());
        r.setName(d.getName());
        r.setDescription(d.getDescription());
        r.setRequiresAttachment(d.getRequiresAttachment());
        r.setStatus(d.getStatus());
        r.setCreatedAt(d.getCreatedAt());
        r.setRowVersion(d.getRowVersion());
        return r;
    }
}
