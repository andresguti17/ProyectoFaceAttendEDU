package com.faceattend_edu.scheduling_service.infrastructure.persistence.adapter;

import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.domain.port.out.EnvironmentRepository;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.mapper.EnvironmentPersistenceMapper;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.repository.EnvironmentJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class EnvironmentPersistenceAdapter implements EnvironmentRepository {
    private final EnvironmentJpaRepository jpaRepository;
    private final EnvironmentPersistenceMapper mapper;

    @Override public Environment save(Environment domain) {
        return mapper.toDomain(jpaRepository.save(mapper.toEntity(domain)));
    }
    @Override public Optional<Environment> findById(Integer id) {
        return jpaRepository.findById(id).map(mapper::toDomain);
    }
    @Override public Optional<Environment> findBySchoolIdAndCode(Integer schoolId, String code) {
        return jpaRepository.findBySchoolIdAndCode(schoolId, code).map(mapper::toDomain);
    }
    @Override public List<Environment> findAll() {
        return jpaRepository.findAll().stream().map(mapper::toDomain).collect(Collectors.toList());
    }
    @Override public List<Environment> findBySchoolId(Integer schoolId) {
        return jpaRepository.findBySchoolId(schoolId).stream().map(mapper::toDomain).collect(Collectors.toList());
    }
    @Override public void deleteById(Integer id) { jpaRepository.deleteById(id); }
    @Override public boolean existsById(Integer id) { return jpaRepository.existsById(id); }
}
