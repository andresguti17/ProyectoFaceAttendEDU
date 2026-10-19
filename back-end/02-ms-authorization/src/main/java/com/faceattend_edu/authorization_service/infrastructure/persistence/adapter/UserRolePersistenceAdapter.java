package com.faceattend_edu.authorization_service.infrastructure.persistence.adapter;

import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.model.UserRole;
import com.faceattend_edu.authorization_service.domain.port.out.UserRoleRepository;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.RoleJpaEntity;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.UserRoleId;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.UserRoleJpaEntity;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.RolePersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.UserRolePersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.repository.RoleJpaRepository;
import com.faceattend_edu.authorization_service.infrastructure.persistence.repository.UserRoleJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class UserRolePersistenceAdapter implements UserRoleRepository {

    private final UserRoleJpaRepository jpaRepository;
    private final RoleJpaRepository roleJpaRepository;
    private final UserRolePersistenceMapper mapper;
    private final RolePersistenceMapper roleMapper;

    @Override
    public UserRole save(UserRole userRole) {
        return mapper.toDomain(jpaRepository.save(mapper.toEntity(userRole)));
    }

    @Override
    public void delete(UUID userId, Integer roleId) {
        jpaRepository.deleteById(new UserRoleId(userId, roleId));
    }

    @Override
    public boolean exists(UUID userId, Integer roleId) {
        return jpaRepository.existsByUserIdAndRoleId(userId, roleId);
    }

    @Override
    public List<Role> findRolesByUserId(UUID userId) {
        return rolesByIdFor(jpaRepository.findByUserId(userId)).values().stream()
                .flatMap(List::stream)
                .collect(Collectors.toList());
    }

    @Override
    public List<UserRole> findByUserId(UUID userId) {
        return jpaRepository.findByUserId(userId).stream().map(mapper::toDomain).collect(Collectors.toList());
    }

    @Override
    public Map<UUID, List<Role>> findRolesByUserIds(Collection<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) return Map.of();
        return rolesByIdFor(jpaRepository.findByUserIdIn(Set.copyOf(userIds)));
    }

    /**
     * Resolves the role rows for a set of assignments with a single roles query. Looking each
     * role up by id inside the loop turned one request into one query per assignment.
     */
    private Map<UUID, List<Role>> rolesByIdFor(List<UserRoleJpaEntity> assignments) {
        if (assignments.isEmpty()) return Map.of();

        Set<Integer> roleIds = assignments.stream()
                .map(UserRoleJpaEntity::getRoleId)
                .collect(Collectors.toSet());
        Map<Integer, Role> rolesById = roleJpaRepository.findAllById(roleIds).stream()
                .collect(Collectors.toMap(RoleJpaEntity::getRoleId, roleMapper::toDomain));

        Map<UUID, List<Role>> byUser = new HashMap<>();
        for (UserRoleJpaEntity assignment : assignments) {
            Role role = rolesById.get(assignment.getRoleId());
            if (role == null) continue; // assignment pointing at a deleted role
            byUser.computeIfAbsent(assignment.getUserId(), key -> new ArrayList<>()).add(role);
        }
        return byUser;
    }
}
