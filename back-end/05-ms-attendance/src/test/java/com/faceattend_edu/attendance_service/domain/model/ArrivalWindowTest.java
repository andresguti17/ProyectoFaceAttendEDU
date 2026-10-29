package com.faceattend_edu.attendance_service.domain.model;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** N-14: Present/Late is decided from the capture time against the class start plus the school tolerance. */
class ArrivalWindowTest {

    private static final ZoneId BOGOTA = ZoneId.of("America/Bogota");
    // Class at 07:00 Bogotá (UTC-5) = 12:00Z, tolerance 15 min → limit 12:15Z.
    private static final ArrivalWindow WINDOW = new ArrivalWindow(LocalDateTime.of(2026, 10, 28, 7, 0), 15, BOGOTA);

    @Test
    void anArrivalBeforeTheClassStartsIsPresent() {
        assertEquals("Present", WINDOW.statusAt(Instant.parse("2026-10-28T11:50:00Z")));
    }

    @Test
    void anArrivalExactlyAtTheToleranceLimitIsStillPresent() {
        assertEquals("Present", WINDOW.statusAt(Instant.parse("2026-10-28T12:15:00Z")));
    }

    @Test
    void oneSecondPastTheToleranceIsLate() {
        assertEquals("Late", WINDOW.statusAt(Instant.parse("2026-10-28T12:15:01Z")));
    }

    @Test
    void theSchoolZoneIsAppliedNotUtc() {
        // 07:10 UTC is 02:10 in Bogotá, long before class; read as UTC it would look 10 minutes into it.
        assertEquals("Present", WINDOW.statusAt(Instant.parse("2026-10-28T07:10:00Z")));
    }

    @Test
    void anArrivalOnALaterDayThanTheSessionIsLate() {
        assertEquals("Late", WINDOW.statusAt(Instant.parse("2026-10-29T11:55:00Z")));
    }

    @Test
    void aZeroToleranceMakesAnyArrivalAfterTheStartLate() {
        ArrivalWindow strict = new ArrivalWindow(LocalDateTime.of(2026, 10, 28, 7, 0), 0, BOGOTA);
        assertEquals("Present", strict.statusAt(Instant.parse("2026-10-28T12:00:00Z")));
        assertEquals("Late", strict.statusAt(Instant.parse("2026-10-28T12:00:01Z")));
    }

    @Test
    void aNegativeToleranceIsRejected() {
        assertThrows(IllegalArgumentException.class,
                () -> new ArrivalWindow(LocalDateTime.of(2026, 10, 28, 7, 0), -1, BOGOTA));
    }
}
