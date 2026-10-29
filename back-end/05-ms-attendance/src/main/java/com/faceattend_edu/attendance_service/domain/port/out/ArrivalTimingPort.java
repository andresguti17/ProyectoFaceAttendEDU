package com.faceattend_edu.attendance_service.domain.port.out;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

/**
 * What the server needs to decide whether an arrival is late: when the class block starts, on which
 * day the session is held and the school's tolerance. The data lives in scheduling and configuration.
 */
public interface ArrivalTimingPort {

    record Timing(LocalDate sessionDate, LocalTime startsAt, int toleranceMinutes) {}

    /** Empty when it cannot be resolved (a service is down, or the session or block has no data). */
    Optional<Timing> find(Long classSessionId, Long academicActorId);
}
