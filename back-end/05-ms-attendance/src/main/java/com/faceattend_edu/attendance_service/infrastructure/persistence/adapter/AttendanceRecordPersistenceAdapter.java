package com.faceattend_edu.attendance_service.infrastructure.persistence.adapter;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordFilter;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordSlice;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.AttendanceRecordJpaEntity;
import com.faceattend_edu.attendance_service.infrastructure.persistence.mapper.AttendanceRecordPersistenceMapper;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.AttendanceRecordJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class AttendanceRecordPersistenceAdapter implements AttendanceRecordRepository {
    private final AttendanceRecordJpaRepository jpaRepository;
    private final AttendanceRecordPersistenceMapper mapper;
    @Override public AttendanceRecord save(AttendanceRecord d){ return mapper.toDomain(jpaRepository.save(mapper.toEntity(d))); }
    @Override public Optional<AttendanceRecord> findById(Long id){ return jpaRepository.findById(id).map(mapper::toDomain); }
    @Override public Optional<AttendanceRecord> findByClassSessionIdAndAcademicActorId(Long s, Long a){ return jpaRepository.findByClassSessionIdAndAcademicActorId(s,a).map(mapper::toDomain); }
    @Override public List<AttendanceRecord> findAll(){ return jpaRepository.findAll().stream().map(mapper::toDomain).collect(Collectors.toList()); }
    @Override public List<AttendanceRecord> findByClassSessionId(Long s){ return jpaRepository.findByClassSessionId(s).stream().map(mapper::toDomain).collect(Collectors.toList()); }
    @Override public AttendanceRecordSlice search(AttendanceRecordFilter f, int offset, Integer limit){
        Set<Long> scope = f.actorScope();
        // Un alcance vacío no ve nada; el IN de una colección vacía no es SQL válido en todas las bases.
        if (scope != null && scope.isEmpty()) return new AttendanceRecordSlice(List.of(), 0);
        Pageable page = limit == null ? Pageable.unpaged() : new OffsetPageRequest(offset, limit);
        Page<AttendanceRecordJpaEntity> rows = jpaRepository.search(
                f.classSessionId() != null, f.classSessionId() == null ? 0L : f.classSessionId(),
                f.academicActorId() != null, f.academicActorId() == null ? 0L : f.academicActorId(),
                f.attendanceStatus() != null, f.attendanceStatus() == null ? "" : f.attendanceStatus(),
                scope != null, scope == null ? Set.of(0L) : scope,
                page);
        return new AttendanceRecordSlice(rows.getContent().stream().map(mapper::toDomain).collect(Collectors.toList()), rows.getTotalElements());
    }
    @Override public void deleteById(Long id){ jpaRepository.deleteById(id); }
    @Override public boolean existsById(Long id){ return jpaRepository.existsById(id); }

    /** PageRequest con offset arbitrario: el contrato ?limit&offset no exige que offset sea múltiplo de limit. */
    static final class OffsetPageRequest extends PageRequest {
        private final long offset;

        OffsetPageRequest(long offset, int limit) {
            super(0, limit, Sort.unsorted());
            this.offset = offset;
        }

        @Override
        public long getOffset() {
            return offset;
        }
    }
}
