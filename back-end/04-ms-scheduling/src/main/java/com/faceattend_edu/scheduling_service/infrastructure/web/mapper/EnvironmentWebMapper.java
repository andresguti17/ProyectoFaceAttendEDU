package com.faceattend_edu.scheduling_service.infrastructure.web.mapper;

import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.CreateEnvironmentRequest;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.EnvironmentResponse;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.UpdateEnvironmentRequest;
import org.springframework.stereotype.Component;

@Component
public class EnvironmentWebMapper {
    public Environment toDomain(CreateEnvironmentRequest req) {
        if (req == null) return null;
        Environment e = new Environment();
        e.setSchoolId(req.getSchoolId());
        e.setCode(req.getCode());
        e.setName(req.getName());
        e.setCapacity(req.getCapacity());
        e.setStatus(req.getStatus() != null ? req.getStatus() : true);
        return e;
    }
    public Environment toDomain(UpdateEnvironmentRequest req) {
        if (req == null) return null;
        Environment e = new Environment();
        e.setSchoolId(req.getSchoolId());
        e.setCode(req.getCode());
        e.setName(req.getName());
        e.setCapacity(req.getCapacity());
        e.setStatus(req.getStatus());
        return e;
    }
    public EnvironmentResponse toResponse(Environment d) {
        if (d == null) return null;
        EnvironmentResponse r = new EnvironmentResponse();
        r.setEnvironmentId(d.getEnvironmentId());
        r.setSchoolId(d.getSchoolId());
        r.setCode(d.getCode());
        r.setName(d.getName());
        r.setCapacity(d.getCapacity());
        r.setStatus(d.getStatus());
        r.setCreatedAt(d.getCreatedAt());
        r.setUpdatedAt(d.getUpdatedAt());
        r.setRowVersion(d.getRowVersion());
        r.setCreatedBy(d.getCreatedBy());
        return r;
    }
}
