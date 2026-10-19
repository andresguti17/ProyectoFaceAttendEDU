package com.faceattend_edu.scheduling_service.infrastructure.persistence.adapter;

import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.port.out.ClassSessionRepository;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.mapper.ClassSessionPersistenceMapper;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.repository.ClassSessionJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ClassSessionPersistenceAdapter implements ClassSessionRepository {
    private final ClassSessionJpaRepository jpaRepository;
    private final ClassSessionPersistenceMapper mapper;

    @Override public ClassSession save(ClassSession domain) {
        return mapper.toDomain(jpaRepository.save(mapper.toEntity(domain)));
    }
    @Override public Optional<ClassSession> findById(Long id) {
        return jpaRepository.findById(id).map(mapper::toDomain);
    }
    @Override public List<ClassSession> findAll() {
        return jpaRepository.findAll().stream().map(mapper::toDomain).collect(Collectors.toList());
    }
    @Override public List<ClassSession> findByScheduleBlockId(Long scheduleBlockId) {
        return jpaRepository.findByScheduleBlockId(scheduleBlockId).stream().map(mapper::toDomain).collect(Collectors.toList());
    }
    @Override public void deleteById(Long id) { jpaRepository.deleteById(id); }
    @Override public boolean existsById(Long id) { return jpaRepository.existsById(id); }
}
