package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.port.in.DeleteJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeleteJustificationUseCaseImpl implements DeleteJustificationUseCase {
    private final JustificationRepository repository;
    @Override public void delete(Long id){ if(!repository.existsById(id)) throw new EntityNotFoundException("Justification", id); repository.deleteById(id); }
}
