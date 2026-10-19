package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.port.in.GetAttendanceRecordUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GetAttendanceRecordUseCaseImpl implements GetAttendanceRecordUseCase {
    private final AttendanceRecordRepository repository;
    @Override public AttendanceRecord getById(Long id) {
        return repository.findById(id).orElseThrow(() -> new EntityNotFoundException("AttendanceRecord", id));
    }
}
