package com.faceattend_edu.scheduling_service.infrastructure.web.mapper;

import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.ClassSessionResponse;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.CreateClassSessionRequest;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.UpdateClassSessionRequest;
import org.springframework.stereotype.Component;
import java.time.Instant;

@Component
public class ClassSessionWebMapper {
    public ClassSession toDomain(CreateClassSessionRequest req) {
        if (req == null) return null;
        ClassSession s = new ClassSession();
        s.setScheduleBlockId(req.getScheduleBlockId());
        s.setSessionDate(req.getSessionDate());
        s.setSessionStatus(req.getSessionStatus() != null ? req.getSessionStatus() : "Open");
        // Una sesión nace ya "Open" (no hay estado "Creada" en el enum), así
        // que el POST /open explícito que sigue siempre choca con "already
        // Open" y openedBy/openedAt nunca quedaban grabados. Si quien crea
        // la sesión es quien la está abriendo (caso normal: el docente pulsa
        // "Iniciar clase"), se registra aquí.
        if (req.getOpenedBy() != null) {
            s.setOpenedBy(req.getOpenedBy());
            s.setOpenedAt(Instant.now());
        }
        return s;
    }
    public ClassSession toDomain(UpdateClassSessionRequest req) {
        if (req == null) return null;
        ClassSession s = new ClassSession();
        s.setScheduleBlockId(req.getScheduleBlockId());
        s.setSessionDate(req.getSessionDate());
        s.setSessionStatus(req.getSessionStatus());
        return s;
    }
    public ClassSessionResponse toResponse(ClassSession d) {
        if (d == null) return null;
        ClassSessionResponse r = new ClassSessionResponse();
        r.setClassSessionId(d.getClassSessionId());
        r.setScheduleBlockId(d.getScheduleBlockId());
        r.setSessionDate(d.getSessionDate());
        r.setSessionStatus(d.getSessionStatus());
        r.setOpenedBy(d.getOpenedBy());
        r.setOpenedAt(d.getOpenedAt());
        r.setClosedBy(d.getClosedBy());
        r.setClosedAt(d.getClosedAt());
        r.setCreatedAt(d.getCreatedAt());
        r.setUpdatedAt(d.getUpdatedAt());
        r.setRowVersion(d.getRowVersion());
        return r;
    }
}
