package com.faceattend_edu.authorization_service.domain.port.out;

import com.faceattend_edu.authorization_service.domain.model.Permission;

import java.util.List;
import java.util.Optional;

public interface PermissionRepository {
    Permission save(Permission permission);
    Optional<Permission> findById(Integer id);
    Optional<Permission> findByPermissionName(String name);
    List<Permission> findAll();
    void deleteById(Integer id);
    boolean existsById(Integer id);
}
