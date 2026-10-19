package com.faceattend_edu.scheduling_service.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDate;

@Data
public class CreateClassSessionRequest {
    @NotNull private Long scheduleBlockId;
    @NotNull private LocalDate sessionDate;
    private String sessionStatus;
    // academic_actor_id de quien abre la clase al crearla (opcional): una
    // sesión nace ya "Open", así que es el único momento en que se puede
    // registrar quién la inició.
    private Long openedBy;
}
