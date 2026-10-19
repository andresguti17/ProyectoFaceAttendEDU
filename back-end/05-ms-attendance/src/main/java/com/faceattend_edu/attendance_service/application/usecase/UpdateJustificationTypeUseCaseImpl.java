package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.domain.port.in.UpdateJustificationTypeUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UpdateJustificationTypeUseCaseImpl implements UpdateJustificationTypeUseCase {
    private final JustificationTypeRepository repository;
    @Override public JustificationType update(Integer id, JustificationType type){
        JustificationType existing = repository.findById(id).orElseThrow(() -> new EntityNotFoundException("JustificationType", id));
        if(type.getName()!=null) existing.setName(type.getName());
        if(type.getDescription()!=null) existing.setDescription(type.getDescription());
        if(type.getRequiresAttachment()!=null) existing.setRequiresAttachment(type.getRequiresAttachment());
        if(type.getStatus()!=null) existing.setStatus(type.getStatus());
        if(type.getSchoolId()!=null) existing.setSchoolId(type.getSchoolId());
        existing.validate(); existing.touchUpdated();
        return repository.save(existing);
    }
}
