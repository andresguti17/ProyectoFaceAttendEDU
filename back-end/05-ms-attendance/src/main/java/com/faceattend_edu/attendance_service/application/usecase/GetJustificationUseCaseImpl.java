package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.port.in.GetJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GetJustificationUseCaseImpl implements GetJustificationUseCase {
    private final JustificationRepository repository;
    @Override public Justification getById(Long id){ return repository.findById(id).orElseThrow(() -> new EntityNotFoundException("Justification", id)); }
}
