package com.faceattend_edu.authorization_service.infrastructure.web.mapper;

import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.infrastructure.web.dto.PermissionResponse;
import org.springframework.stereotype.Component;

@Component
public class PermissionWebMapper {
    public PermissionResponse toResponse(Permission domain) {
        if (domain == null) return null;
        PermissionResponse r = new PermissionResponse();
        r.setPermissionId(domain.getPermissionId());
        r.setPermissionName(domain.getPermissionName());
        r.setDescription(domain.getDescription());
        r.setCreatedAt(domain.getCreatedAt());
        r.setUpdatedAt(domain.getUpdatedAt());
        r.setCreatedBy(domain.getCreatedBy());
        r.setRowVersion(domain.getRowVersion());
        return r;
    }
}
