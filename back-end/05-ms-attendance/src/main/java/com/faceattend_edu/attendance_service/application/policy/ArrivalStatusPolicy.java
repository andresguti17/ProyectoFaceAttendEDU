package com.faceattend_edu.attendance_service.application.policy;

import com.faceattend_edu.attendance_service.domain.port.out.ArrivalTimingPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Set;

/**
 * Decides Present or Late for a biometric arrival from the server clock, the block start and the school's
 * tolerance, instead of trusting the status the kiosk sends (finding N-14). MANUAL and IMPORT records, and
 * every status other than Present/Late, keep what the caller sent: an instructor may correct by hand.
 * If the timing cannot be resolved the status sent by the client is kept, so a downstream outage never
 * blocks a check-in.
 */
@Component
public class ArrivalStatusPolicy {

    private static final Set<String> BIOMETRIC = Set.of("FACIAL", "FINGERPRINT");
    private static final Set<String> ARRIVAL = Set.of("Present", "Late");

    private final ArrivalTimingPort timing;
    private final ZoneId zone;

    public ArrivalStatusPolicy(ArrivalTimingPort timing, @Value("${faceattend.attendance.zone:America/Bogota}") String zone) {
        this.timing = timing;
        this.zone = ZoneId.of(zone);
    }

    public String resolve(Long classSessionId, Long academicActorId, String status, String captureMethod, Instant capturedAt) {
        if (!BIOMETRIC.contains(captureMethod) || !ARRIVAL.contains(status)) return status;
        Instant at = capturedAt == null ? Instant.now() : capturedAt;
        return timing.find(classSessionId, academicActorId)
                .map(t -> isLate(t, at) ? "Late" : "Present")
                .orElse(status);
    }

    /** Same rule the kiosk used: late when more than the tolerance has passed, counted in whole minutes. */
    boolean isLate(ArrivalTimingPort.Timing t, Instant at) {
        var start = t.sessionDate().atTime(t.startsAt()).truncatedTo(ChronoUnit.MINUTES);
        var arrival = at.atZone(zone).toLocalDateTime().truncatedTo(ChronoUnit.MINUTES);
        return ChronoUnit.MINUTES.between(start, arrival) > t.toleranceMinutes();
    }
}
