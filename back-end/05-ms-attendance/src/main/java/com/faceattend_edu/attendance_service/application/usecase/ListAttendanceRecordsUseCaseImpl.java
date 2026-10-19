package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordFilter;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordSlice;
import com.faceattend_edu.attendance_service.domain.port.in.ListAttendanceRecordsUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ListAttendanceRecordsUseCaseImpl implements ListAttendanceRecordsUseCase {
    private final AttendanceRecordRepository repository;
    @Override public AttendanceRecordSlice search(AttendanceRecordFilter filter, int offset, Integer limit){ return repository.search(filter, offset, limit); }
}
