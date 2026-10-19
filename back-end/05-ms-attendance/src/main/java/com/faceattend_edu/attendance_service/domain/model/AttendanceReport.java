package com.faceattend_edu.attendance_service.domain.model;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Attendance report computed on the fly from {@code attendance_record} rows
 * (nothing is stored). The attendance rate is {@code (present + late) / total}:
 * a justified absence was still an absence.
 */
public final class AttendanceReport {

    /** One grouped row coming from the repository: a count of records per (session, actor, status). */
    public record Row(Long classSessionId, Long academicActorId, String attendanceStatus, long total) {
    }

    /** Counts per status plus the derived total and rate. */
    public static final class Counts {
        private long present;
        private long late;
        private long absent;
        private long justified;

        void add(String status, long count) {
            switch (status) {
                case "Present" -> present += count;
                case "Late" -> late += count;
                case "Absent" -> absent += count;
                case "Justified" -> justified += count;
                default -> { }
            }
        }

        public long getPresent() { return present; }
        public long getLate() { return late; }
        public long getAbsent() { return absent; }
        public long getJustified() { return justified; }
        public long getTotal() { return present + late + absent + justified; }

        /** Percentage 0-100 with one decimal, or {@code null} when there are no records. */
        public Double getAttendanceRate() {
            long total = getTotal();
            if (total == 0) return null;
            return Math.round(((present + late) * 1000.0) / total) / 10.0;
        }
    }

    private final Counts totals = new Counts();
    private final Map<Long, Counts> byActor = new TreeMap<>();
    private final Map<Long, Counts> bySession = new TreeMap<>();

    public static AttendanceReport from(List<Row> rows) {
        AttendanceReport report = new AttendanceReport();
        for (Row row : rows) {
            report.totals.add(row.attendanceStatus(), row.total());
            report.byActor.computeIfAbsent(row.academicActorId(), k -> new Counts()).add(row.attendanceStatus(), row.total());
            report.bySession.computeIfAbsent(row.classSessionId(), k -> new Counts()).add(row.attendanceStatus(), row.total());
        }
        return report;
    }

    public Counts getTotals() { return totals; }

    public Map<Long, Counts> getByActor() { return byActor; }

    public Map<Long, Counts> getBySession() { return bySession; }

    /** CSV with one line per scope: TOTAL, then every actor, then every session. */
    public String toCsv() {
        List<String> lines = new ArrayList<>();
        lines.add("scope,id,present,late,absent,justified,total,attendanceRate");
        lines.add(csvLine("TOTAL", "", totals));
        byActor.forEach((id, counts) -> lines.add(csvLine("ACTOR", String.valueOf(id), counts)));
        bySession.forEach((id, counts) -> lines.add(csvLine("SESSION", String.valueOf(id), counts)));
        return String.join("\n", lines) + "\n";
    }

    private static String csvLine(String scope, String id, Counts c) {
        String rate = c.getAttendanceRate() == null ? "" : String.valueOf(c.getAttendanceRate());
        return String.join(",", scope, id, String.valueOf(c.getPresent()), String.valueOf(c.getLate()),
                String.valueOf(c.getAbsent()), String.valueOf(c.getJustified()), String.valueOf(c.getTotal()), rate);
    }

    /** Ordered view used by the JSON response. */
    public Map<String, Object> toResponse() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("rateDefinition", "attendanceRate = (present + late) / total * 100");
        body.put("totals", totals);
        body.put("byActor", entries(byActor, "academicActorId"));
        body.put("bySession", entries(bySession, "classSessionId"));
        return body;
    }

    private static List<Map<String, Object>> entries(Map<Long, Counts> source, String idName) {
        return source.entrySet().stream()
                .sorted(Comparator.comparing(Map.Entry::getKey))
                .map(e -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put(idName, e.getKey());
                    item.put("counts", e.getValue());
                    return item;
                })
                .toList();
    }
}
