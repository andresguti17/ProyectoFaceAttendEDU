package com.faceattend_edu.authorization_service.domain.port.out;

import com.faceattend_edu.authorization_service.domain.model.Role;

import java.util.List;
import java.util.Optional;

public interface RoleRepository {
    Role save(Role role);
    Optional<Role> findById(Integer id);
    Optional<Role> findByRoleName(String roleName);
    List<Role> findAll();
    void deleteById(Integer id);
    boolean existsById(Integer id);
}
