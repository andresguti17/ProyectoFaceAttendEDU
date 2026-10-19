package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.port.in.UpdateAttendanceRecordUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UpdateAttendanceRecordUseCaseImpl implements UpdateAttendanceRecordUseCase {
    private final AttendanceRecordRepository repository;
    @Override
    public AttendanceRecord update(Long id, AttendanceRecord record) {
        AttendanceRecord existing = repository.findById(id).orElseThrow(() -> new EntityNotFoundException("AttendanceRecord", id));
        if (record.getAttendanceStatus() != null) existing.setAttendanceStatus(record.getAttendanceStatus());
        if (record.getCaptureMethod() != null) existing.setCaptureMethod(record.getCaptureMethod());
        if (record.getMatchScore() != null) existing.setMatchScore(record.getMatchScore());
        if (record.getCapturedAt() != null) existing.setCapturedAt(record.getCapturedAt());
        existing.validate();
        existing.touchUpdated();
        return repository.save(existing);
    }
}
