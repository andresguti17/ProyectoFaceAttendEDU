package com.faceattend_edu.attendance_service.infrastructure.persistence.adapter;

import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationTypeRepository;
import com.faceattend_edu.attendance_service.infrastructure.persistence.mapper.JustificationTypePersistenceMapper;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.JustificationTypeJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class JustificationTypePersistenceAdapter implements JustificationTypeRepository {
    private final JustificationTypeJpaRepository jpaRepository;
    private final JustificationTypePersistenceMapper mapper;
    @Override public JustificationType save(JustificationType d){ return mapper.toDomain(jpaRepository.save(mapper.toEntity(d))); }
    @Override public Optional<JustificationType> findById(Integer id){ return jpaRepository.findById(id).map(mapper::toDomain); }
    @Override public Optional<JustificationType> findByName(String n){ return jpaRepository.findByName(n).map(mapper::toDomain); }
    @Override public Optional<JustificationType> findByNameAndSchoolId(String name, Integer schoolId){ return jpaRepository.findByNameAndSchoolId(name, schoolId).map(mapper::toDomain); }
    @Override public Optional<JustificationType> findByNameAndSchoolIdIsNull(String name){ return jpaRepository.findByNameAndSchoolIdIsNull(name).map(mapper::toDomain); }
    @Override public List<JustificationType> findAll(){ return jpaRepository.findAll().stream().map(mapper::toDomain).collect(Collectors.toList()); }
    @Override public void deleteById(Integer id){ jpaRepository.deleteById(id); }
    @Override public boolean existsById(Integer id){ return jpaRepository.existsById(id); }
}
