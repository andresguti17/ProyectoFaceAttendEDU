package com.faceattend_edu.authorization_service.infrastructure.persistence.adapter;

import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.port.out.PermissionRepository;
import com.faceattend_edu.authorization_service.infrastructure.persistence.mapper.PermissionPersistenceMapper;
import com.faceattend_edu.authorization_service.infrastructure.persistence.repository.PermissionJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class PermissionPersistenceAdapter implements PermissionRepository {

    private final PermissionJpaRepository jpaRepository;
    private final PermissionPersistenceMapper mapper;

    @Override
    public Permission save(Permission permission) {
        return mapper.toDomain(jpaRepository.save(mapper.toEntity(permission)));
    }

    @Override
    public Optional<Permission> findById(Integer id) {
        return jpaRepository.findById(id).map(mapper::toDomain);
    }

    @Override
    public Optional<Permission> findByPermissionName(String name) {
        return jpaRepository.findByPermissionName(name).map(mapper::toDomain);
    }

    @Override
    public List<Permission> findAll() {
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
