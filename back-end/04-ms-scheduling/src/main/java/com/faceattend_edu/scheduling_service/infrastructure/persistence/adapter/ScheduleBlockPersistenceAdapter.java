package com.faceattend_edu.scheduling_service.infrastructure.persistence.adapter;

import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.out.ScheduleBlockRepository;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.mapper.ScheduleBlockPersistenceMapper;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.repository.ScheduleBlockJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ScheduleBlockPersistenceAdapter implements ScheduleBlockRepository {
    private final ScheduleBlockJpaRepository jpaRepository;
    private final ScheduleBlockPersistenceMapper mapper;

    @Override public ScheduleBlock save(ScheduleBlock domain) {
        return mapper.toDomain(jpaRepository.save(mapper.toEntity(domain)));
    }
    @Override public Optional<ScheduleBlock> findById(Long id) {
        return jpaRepository.findById(id).map(mapper::toDomain);
    }
    @Override public List<ScheduleBlock> findAll() {
        return jpaRepository.findAll().stream().map(mapper::toDomain).collect(Collectors.toList());
    }
    @Override public void deleteById(Long id) { jpaRepository.deleteById(id); }
    @Override public boolean existsById(Long id) { return jpaRepository.existsById(id); }

    // A new block has no id yet: -1 never matches a real primary key.
    @Override public boolean existsEnvironmentOverlap(Integer environmentId, Short dayOfWeek, LocalTime startsAt, LocalTime endsAt, Long excludeId) {
        return jpaRepository.existsEnvironmentOverlap(environmentId, dayOfWeek, startsAt, endsAt, excludeId == null ? -1L : excludeId);
    }

    @Override public boolean existsInstructorOverlap(Long instructorActorId, Short dayOfWeek, LocalTime startsAt, LocalTime endsAt, Long excludeId) {
        return jpaRepository.existsInstructorOverlap(instructorActorId, dayOfWeek, startsAt, endsAt, excludeId == null ? -1L : excludeId);
    }
}
