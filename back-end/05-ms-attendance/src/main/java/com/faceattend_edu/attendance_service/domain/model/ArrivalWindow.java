package com.faceattend_edu.attendance_service.domain.model;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Objects;

/**
 * When a class starts (school local time) and how many minutes a learner may arrive
 * after it before the arrival counts as Late (the school's tardy_tolerance_minutes).
 * The server decides Present/Late from the capture time (N-14): the kiosk's clock and
 * its own reading of the tolerance are never trusted.
 */
public record ArrivalWindow(LocalDateTime startsAt, int toleranceMinutes, ZoneId zone) {

    public ArrivalWindow {
        Objects.requireNonNull(startsAt, "startsAt is required");
        Objects.requireNonNull(zone, "zone is required");
        if (toleranceMinutes < 0) throw new IllegalArgumentException("toleranceMinutes must not be negative");
    }

    /** Late only once the tolerance has fully passed; arriving exactly at the limit is still Present. */
    public String statusAt(Instant capturedAt) {
        Instant limit = startsAt.plusMinutes(toleranceMinutes).atZone(zone).toInstant();
        return capturedAt.isAfter(limit) ? "Late" : "Present";
    }
}
