package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.model.AttendanceReport;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.AttendanceRecordJpaRepository;
import com.faceattend_edu.attendance_service.infrastructure.web.security.ActorScope;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Attendance reports computed on the fly from {@code attendance_record}.
 *
 * <p>This service only knows sessions and actors by id (their calendar date and
 * cohort live in scheduling and academic, with no cross-context joins), so the
 * caller picks the scope: it resolves the sessions of a cohort or a date range
 * from scheduling and passes their ids here.</p>
 */
@RestController
@RequestMapping({"/api/v1/attendance-reports", "/attendance-reports"})
@RequiredArgsConstructor
public class AttendanceReportController {

    private static final int MAX_IDS = 1_000;
    private static final MediaType CSV = MediaType.parseMediaType("text/csv");

    private final AttendanceRecordJpaRepository recordRepository;

    @GetMapping
    public ResponseEntity<?> report(
            @RequestParam(name = "classSessionIds", required = false) List<Long> classSessionIds,
            @RequestParam(name = "academicActorIds", required = false) List<Long> academicActorIds,
            @RequestParam(name = "format", defaultValue = "json") String format) {
        boolean bySessions = classSessionIds != null && !classSessionIds.isEmpty();
        boolean byActors = academicActorIds != null && !academicActorIds.isEmpty();
        if (!bySessions && !byActors) {
            throw new IllegalArgumentException("Provide classSessionIds and/or academicActorIds to scope the report");
        }
        if ((bySessions && classSessionIds.size() > MAX_IDS) || (byActors && academicActorIds.size() > MAX_IDS)) {
            throw new IllegalArgumentException("classSessionIds and academicActorIds accept at most " + MAX_IDS + " ids each");
        }
        if (!format.equalsIgnoreCase("json") && !format.equalsIgnoreCase("csv")) {
            throw new IllegalArgumentException("format must be json or csv");
        }

        // A filter that is not used gets a placeholder set; the flag switches it off.
        List<AttendanceReport.Row> rows = recordRepository.countByGroups(
                bySessions, bySessions ? Set.copyOf(classSessionIds) : Set.of(-1L),
                byActors, byActors ? Set.copyOf(academicActorIds) : Set.of(-1L))
                .stream()
                .filter(r -> ActorScope.allows(r.getAcademicActorId()))
                .map(r -> new AttendanceReport.Row(r.getClassSessionId(), r.getAcademicActorId(), r.getAttendanceStatus(), r.getTotal()))
                .toList();
        AttendanceReport report = AttendanceReport.from(rows);

        if (format.equalsIgnoreCase("csv")) {
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"attendance-report.csv\"")
                    .contentType(CSV)
                    .body(report.toCsv());
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("generatedAt", Instant.now().toString());
        body.put("filters", Map.of(
                "classSessionIds", bySessions ? classSessionIds : List.of(),
                "academicActorIds", byActors ? academicActorIds : List.of()));
        body.putAll(report.toResponse());
        return ResponseEntity.ok(body);
    }
}
