package com.faceattend_edu.scheduling_service.domain.port.out;

import com.faceattend_edu.scheduling_service.domain.model.Environment;
import java.util.List;
import java.util.Optional;

public interface EnvironmentRepository {
    Environment save(Environment environment);
    Optional<Environment> findById(Integer id);
    Optional<Environment> findBySchoolIdAndCode(Integer schoolId, String code);
    List<Environment> findAll();
    List<Environment> findBySchoolId(Integer schoolId);
    void deleteById(Integer id);
    boolean existsById(Integer id);
}
