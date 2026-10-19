package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.domain.port.in.ListJustificationTypesUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ListJustificationTypesUseCaseImpl implements ListJustificationTypesUseCase {
    private final JustificationTypeRepository repository;
    @Override public List<JustificationType> list(){ return repository.findAll(); }
}
