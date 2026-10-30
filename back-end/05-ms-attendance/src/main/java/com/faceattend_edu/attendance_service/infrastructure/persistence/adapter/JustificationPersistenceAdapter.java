package com.faceattend_edu.attendance_service.infrastructure.persistence.adapter;

import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.model.JustificationFilter;
import com.faceattend_edu.attendance_service.domain.model.JustificationSlice;
import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.JustificationJpaEntity;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationRepository;
import com.faceattend_edu.attendance_service.infrastructure.persistence.mapper.JustificationPersistenceMapper;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.JustificationJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class JustificationPersistenceAdapter implements JustificationRepository {
    /** Relleno del filtro de estado apagado: valor válido del ENUM review_status (ver AttendanceRecordPersistenceAdapter). */
    static final String STATUS_PLACEHOLDER = "Pending";
    private final JustificationJpaRepository jpaRepository;
    private final JustificationPersistenceMapper mapper;
    @Override public Justification save(Justification d){ return mapper.toDomain(jpaRepository.save(mapper.toEntity(d))); }
    @Override public Optional<Justification> findById(Long id){ return jpaRepository.findById(id).map(mapper::toDomain); }
    @Override public Optional<Justification> findByAttendanceRecordId(Long a){ return jpaRepository.findByAttendanceRecordId(a).map(mapper::toDomain); }
    @Override public JustificationSlice search(JustificationFilter f, int offset, Integer limit){
        Set<Long> scope = f.actorScope();
        // Un alcance vacío no ve nada (y un IN vacío no es SQL válido en todas las bases).
        if (scope != null && scope.isEmpty()) return new JustificationSlice(List.of(), 0);
        Pageable page = limit == null ? Pageable.unpaged() : new AttendanceRecordPersistenceAdapter.OffsetPageRequest(offset, limit);
        Page<JustificationJpaEntity> rows = jpaRepository.search(
                f.reviewStatus() != null, f.reviewStatus() == null ? STATUS_PLACEHOLDER : f.reviewStatus(),
                f.attendanceRecordId() != null, f.attendanceRecordId() == null ? 0L : f.attendanceRecordId(),
                scope != null, scope == null ? Set.of(0L) : scope,
                page);
        return new JustificationSlice(rows.getContent().stream().map(mapper::toDomain).collect(Collectors.toList()), rows.getTotalElements());
    }
    @Override public void deleteById(Long id){ jpaRepository.deleteById(id); }
    @Override public boolean existsById(Long id){ return jpaRepository.existsById(id); }
}
