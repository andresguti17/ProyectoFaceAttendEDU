package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.domain.port.in.GetJustificationTypeUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GetJustificationTypeUseCaseImpl implements GetJustificationTypeUseCase {
    private final JustificationTypeRepository repository;
    @Override public JustificationType getById(Integer id){ return repository.findById(id).orElseThrow(() -> new EntityNotFoundException("JustificationType", id)); }
}
