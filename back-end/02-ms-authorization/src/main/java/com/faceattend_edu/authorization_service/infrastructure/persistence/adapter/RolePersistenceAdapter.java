package com.faceattend_edu.authorization_service.infrastructure.persistence.adapter;

import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.RolePersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.repository.RoleJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class RolePersistenceAdapter implements RoleRepository {

    private final RoleJpaRepository jpaRepository;
    private final RolePersistenceMapper mapper;

    @Override
    public Role save(Role role) {
        return mapper.toDomain(jpaRepository.save(mapper.toEntity(role)));
    }

    @Override
    public Optional<Role> findById(Integer id) {
        return jpaRepository.findById(id).map(mapper::toDomain);
    }

    @Override
    public Optional<Role> findByRoleName(String roleName) {
        return jpaRepository.findByRoleName(roleName).map(mapper::toDomain);
    }

    @Override
    public List<Role> findAll() {
        return jpaRepository.findAll().stream().map(mapper::toDomain).collect(Collectors.toList());
    }

    @Override
    public void deleteById(Integer id) {
        jpaRepository.deleteById(id);
    }

    @Override
    public boolean existsById(Integer id) {
        return jpaRepository.existsById(id);
    }
}
