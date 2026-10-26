package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.model.JustificationFilter;
import com.faceattend_edu.attendance_service.domain.model.JustificationSlice;
import com.faceattend_edu.attendance_service.domain.port.in.ListJustificationsUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ListJustificationsUseCaseImpl implements ListJustificationsUseCase {
    private final JustificationRepository repository;
    @Override public JustificationSlice search(JustificationFilter filter, int offset, Integer limit){ return repository.search(filter, offset, limit); }
}
