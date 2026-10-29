package com.faceattend_edu.attendance_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class AttendanceRecord {
    private Long attendanceRecordId;
    private Long classSessionId;
    private Long academicActorId;
    private String attendanceStatus;
    private String captureMethod;
    private Instant capturedAt;
    private BigDecimal matchScore;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private UUID deletedBy;
    private long rowVersion;

    private static final Set<String> ALLOWED_STATUS = Set.of("Present","Absent","Late","Justified");
    private static final Set<String> ALLOWED_METHOD = Set.of("FACIAL","MANUAL","FINGERPRINT","IMPORT");

    public void validate() {
        if (classSessionId == null) throw new IllegalArgumentException("classSessionId is required");
        if (academicActorId == null) throw new IllegalArgumentException("academicActorId is required");
        if (attendanceStatus == null || attendanceStatus.isBlank()) throw new IllegalArgumentException("attendanceStatus is required");
        if (!ALLOWED_STATUS.contains(attendanceStatus)) throw new IllegalArgumentException("attendanceStatus must be one of " + ALLOWED_STATUS);
        if (captureMethod == null || captureMethod.isBlank()) throw new IllegalArgumentException("captureMethod is required");
        if (!ALLOWED_METHOD.contains(captureMethod)) throw new IllegalArgumentException("captureMethod must be one of " + ALLOWED_METHOD);
        if (matchScore != null && (matchScore.compareTo(BigDecimal.ZERO) < 0 || matchScore.compareTo(BigDecimal.ONE) > 0))
            throw new IllegalArgumentException("matchScore must be between 0 and 1");
    }

    /** An arrival (Present or Late, from a capture) as opposed to Absent/Justified, which nobody "arrives" with. */
    public boolean isArrival() {
        return "Present".equals(attendanceStatus) || "Late".equals(attendanceStatus);
    }

    /**
     * N-14: the server stamps the capture time and decides Present/Late from it; whatever
     * arrival status or time the client sent is ignored.
     */
    public void applyArrival(ArrivalWindow window, Instant now) {
        capturedAt = now;
        attendanceStatus = window.statusAt(now);
    }

    public void touchCreated() {
        if (createdAt == null) createdAt = Instant.now();
        // Una ausencia no tiene captura: el modelo declara captured_at NULL justo
        // para eso. Rellenarlo siempre dejaba a cada ausente con hora de registro
        // biometrico como si hubiera pasado por el lector.
        if (capturedAt == null && !"Absent".equals(attendanceStatus)) capturedAt = Instant.now();
        if (rowVersion == 0) rowVersion = 1L;
    }
    public void touchUpdated() {
        updatedAt = Instant.now();
        // row_version is owned by JPA @Version (reinforced by fn_audit_timestamps trigger);
        // pre-incrementing it here makes merge() fail with StaleObjectStateException
    }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof AttendanceRecord)) return false;
        AttendanceRecord that = (AttendanceRecord) o;
        return Objects.equals(attendanceRecordId, that.attendanceRecordId);
    }
    @Override public int hashCode() { return Objects.hash(attendanceRecordId); }
}
