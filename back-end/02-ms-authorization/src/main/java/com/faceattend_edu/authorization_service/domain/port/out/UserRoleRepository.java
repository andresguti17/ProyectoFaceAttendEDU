package com.faceattend_edu.authorization_service.domain.port.out;

import com.faceattend_edu.authorization_service.domain.model.UserRole;
import com.faceattend_edu.authorization_service.domain.model.Role;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface UserRoleRepository {
    UserRole save(UserRole userRole);
    void delete(UUID userId, Integer roleId);
    boolean exists(UUID userId, Integer roleId);
    List<Role> findRolesByUserId(UUID userId);
    List<UserRole> findByUserId(UUID userId);

    /** Roles for many users at once; users without roles are absent from the map. */
    Map<UUID, List<Role>> findRolesByUserIds(Collection<UUID> userIds);
}
