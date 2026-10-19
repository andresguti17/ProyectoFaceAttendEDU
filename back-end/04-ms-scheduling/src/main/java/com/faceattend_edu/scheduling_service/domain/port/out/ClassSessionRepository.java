package com.faceattend_edu.scheduling_service.domain.port.out;

import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import java.util.List;
import java.util.Optional;

public interface ClassSessionRepository {
    ClassSession save(ClassSession session);
    Optional<ClassSession> findById(Long id);
    List<ClassSession> findAll();
    List<ClassSession> findByScheduleBlockId(Long scheduleBlockId);
    void deleteById(Long id);
    boolean existsById(Long id);
}
