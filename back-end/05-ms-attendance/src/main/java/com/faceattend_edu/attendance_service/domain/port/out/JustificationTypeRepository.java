package com.faceattend_edu.attendance_service.domain.port.out;

import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import java.util.List;
import java.util.Optional;

public interface JustificationTypeRepository {
    JustificationType save(JustificationType t);
    Optional<JustificationType> findById(Integer id);
    Optional<JustificationType> findByName(String name);
    Optional<JustificationType> findByNameAndSchoolId(String name, Integer schoolId);
    Optional<JustificationType> findByNameAndSchoolIdIsNull(String name);
    List<JustificationType> findAll();
    void deleteById(Integer id);
    boolean existsById(Integer id);
}
