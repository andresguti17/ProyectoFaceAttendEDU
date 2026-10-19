package com.faceattend_edu.attendance_service.infrastructure.persistence.adapter;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import com.faceattend_edu.attendance_service.infrastructure.persistence.mapper.SupportingDocumentPersistenceMapper;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.SupportingDocumentJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class SupportingDocumentPersistenceAdapter implements SupportingDocumentRepository {
    private final SupportingDocumentJpaRepository jpaRepository;
    private final SupportingDocumentPersistenceMapper mapper;
    @Override public SupportingDocument save(SupportingDocument d){ return mapper.toDomain(jpaRepository.save(mapper.toEntity(d))); }
    @Override public Optional<SupportingDocument> findById(Long id){ return jpaRepository.findById(id).map(mapper::toDomain); }
    @Override public List<SupportingDocument> findAll(){ return jpaRepository.findAll().stream().map(mapper::toDomain).collect(Collectors.toList()); }
    @Override public List<SupportingDocument> findByJustificationId(Long j){ return jpaRepository.findByJustificationId(j).stream().map(mapper::toDomain).collect(Collectors.toList()); }
    @Override public void deleteById(Long id){ jpaRepository.deleteById(id); }
    @Override public boolean existsById(Long id){ return jpaRepository.existsById(id); }
}
