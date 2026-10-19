package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.port.in.DeleteJustificationTypeUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeleteJustificationTypeUseCaseImpl implements DeleteJustificationTypeUseCase {
    private final JustificationTypeRepository repository;
    @Override public void delete(Integer id){ if(!repository.existsById(id)) throw new EntityNotFoundException("JustificationType", id); repository.deleteById(id); }
}
