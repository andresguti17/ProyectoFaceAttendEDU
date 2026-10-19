package com.faceattend_edu.authorization_service.infrastructure.persistence.entity;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@AllArgsConstructor
@NoArgsConstructor
@EqualsAndHashCode
public class RolePermissionId implements Serializable {
    private Integer roleId;
    private Integer permissionId;
}
