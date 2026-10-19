package com.faceattend_edu.authorization_service.infrastructure.persistence.adapter;

import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.model.RolePermission;
import com.faceattend_edu.authorization_service.domain.port.out.RolePermissionRepository;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.RolePermissionJpaEntity;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.RolePermissionId;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.PermissionPersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.RolePermissionPersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.repository.PermissionJpaRepository;
import com.faceattend_edu.authorization_service.infrastructure.persistence.repository.RolePermissionJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class RolePermissionPersistenceAdapter implements RolePermissionRepository {

    private final RolePermissionJpaRepository jpaRepository;
    private final PermissionJpaRepository permissionJpaRepository;
    private final RolePermissionPersistenceMapper mapper;
    private final PermissionPersistenceMapper permissionMapper;

    @Override
    public RolePermission save(RolePermission rolePermission) {
        return mapper.toDomain(jpaRepository.save(mapper.toEntity(rolePermission)));
    }

    @Override
    public void delete(Integer roleId, Integer permissionId) {
        jpaRepository.deleteById(new RolePermissionId(roleId, permissionId));
    }

    @Override
    public boolean exists(Integer roleId, Integer permissionId) {
        return jpaRepository.existsByRoleIdAndPermissionId(roleId, permissionId);
    }

    @Override
    public List<Permission> findPermissionsByRoleId(Integer roleId) {
        List<RolePermissionJpaEntity> rps = jpaRepository.findByRoleId(roleId);
        return rps.stream()
                .map(rp -> permissionJpaRepository.findById(rp.getPermissionId()).orElse(null))
                .filter(e -> e != null)
                .map(permissionMapper::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<RolePermission> findByRoleId(Integer roleId) {
        return jpaRepository.findByRoleId(roleId).stream().map(mapper::toDomain).collect(Collectors.toList());
    }
}
