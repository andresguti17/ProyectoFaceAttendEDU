package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.port.in.BulkRecordAttendanceUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.RecordAttendanceUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BulkRecordAttendanceUseCaseImpl implements BulkRecordAttendanceUseCase {
    private final RecordAttendanceUseCase recordAttendanceUseCase;

    @Override @Transactional
    public List<AttendanceRecord> bulk(List<AttendanceRecord> records) {
        List<AttendanceRecord> saved = new ArrayList<>();
        for (AttendanceRecord r : records) {
            saved.add(recordAttendanceUseCase.record(r.getClassSessionId(), r.getAcademicActorId(), r.getAttendanceStatus(), r.getCaptureMethod(), r.getMatchScore()));
        }
        return saved;
    }
}
