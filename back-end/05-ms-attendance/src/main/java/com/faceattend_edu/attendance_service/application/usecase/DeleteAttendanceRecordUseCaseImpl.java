package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.port.in.DeleteAttendanceRecordUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeleteAttendanceRecordUseCaseImpl implements DeleteAttendanceRecordUseCase {
    private final AttendanceRecordRepository repository;
    @Override public void delete(Long id){
        if(!repository.existsById(id)) throw new EntityNotFoundException("AttendanceRecord", id);
        repository.deleteById(id);
    }
}
