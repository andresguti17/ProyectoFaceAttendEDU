package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.port.in.ListJustificationsUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ListJustificationsUseCaseImpl implements ListJustificationsUseCase {
    private final JustificationRepository repository;
    @Override public List<Justification> list(){ return repository.findAll(); }
}
