package com.faceattend_edu.authorization_service.infrastructure.web.mapper;

import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.infrastructure.web.dto.RoleResponse;
import org.springframework.stereotype.Component;

@Component
public class RoleWebMapper {
    public RoleResponse toResponse(Role domain) {
        if (domain == null) return null;
        RoleResponse r = new RoleResponse();
        r.setRoleId(domain.getRoleId());
        r.setRoleName(domain.getRoleName());
        r.setDescription(domain.getDescription());
        r.setCreatedAt(domain.getCreatedAt());
        r.setUpdatedAt(domain.getUpdatedAt());
        r.setCreatedBy(domain.getCreatedBy());
        r.setRowVersion(domain.getRowVersion());
        return r;
    }
}
