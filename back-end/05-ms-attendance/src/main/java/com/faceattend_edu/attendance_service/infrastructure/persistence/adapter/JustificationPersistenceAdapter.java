package com.faceattend_edu.attendance_service.infrastructure.persistence.adapter;

import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationRepository;
import com.faceattend_edu.attendance_service.infrastructure.persistence.mapper.JustificationPersistenceMapper;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.JustificationJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class JustificationPersistenceAdapter implements JustificationRepository {
    private final JustificationJpaRepository jpaRepository;
    private final JustificationPersistenceMapper mapper;
    @Override public Justification save(Justification d){ return mapper.toDomain(jpaRepository.save(mapper.toEntity(d))); }
    @Override public Optional<Justification> findById(Long id){ return jpaRepository.findById(id).map(mapper::toDomain); }
    @Override public Optional<Justification> findByAttendanceRecordId(Long a){ return jpaRepository.findByAttendanceRecordId(a).map(mapper::toDomain); }
    @Override public List<Justification> findAll(){ return jpaRepository.findAll().stream().map(mapper::toDomain).collect(Collectors.toList()); }
    @Override public void deleteById(Long id){ jpaRepository.deleteById(id); }
    @Override public boolean existsById(Long id){ return jpaRepository.existsById(id); }
}
