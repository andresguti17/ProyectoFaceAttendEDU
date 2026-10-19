package com.faceattend_edu.authorization_service.infrastructure.web.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * ISO/IEC 9001 — Quality Health Endpoint (Cláusula 9.1)
 * Authorization Service
 */
@RestController
@RequestMapping({"/health/quality", "/api/v1/quality/report"})
public class QualityHealthController {

    private final QualityAuditInterceptor auditInterceptor;

    public QualityHealthController(QualityAuditInterceptor auditInterceptor) {
        this.auditInterceptor = auditInterceptor;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> qualityReport() {
        QualityAuditInterceptor.QualityMetricsSnapshot m = auditInterceptor.getMetrics();
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("service", "02-ms-authorization");
        report.put("timestamp", Instant.now().toString());
        report.put("iso_compliance", "ISO/IEC 9001:2015");

        Map<String, Object> kpis = new LinkedHashMap<>();
        kpis.put("total_operations", m.totalOperations());
        kpis.put("success_count", m.successCount());
        kpis.put("error_count", m.errorCount());
        kpis.put("error_rate_pct", String.format("%.2f%%", m.errorRate()));
        kpis.put("avg_response_time_ms", String.format("%.2f", m.avgResponseTimeMs()));
        kpis.put("availability_status", m.errorRate() < 1.0 ? "HEALTHY" : "DEGRADED");
        report.put("kpis", kpis);

        Map<String, Object> crud = new LinkedHashMap<>();
        crud.put("creates", m.createCount()); crud.put("reads", m.readCount());
        crud.put("updates", m.updateCount()); crud.put("deletes", m.deleteCount());
        report.put("crud_operations", crud);

        Map<String, Object> errors = new LinkedHashMap<>();
        errors.put("client_errors_4xx", m.clientErrors()); errors.put("server_errors_5xx", m.serverErrors());
        errors.put("total_errors", m.errorCount());
        report.put("error_classification", errors);

        double availability = m.totalOperations() == 0 ? 100.0 : ((double) m.successCount() / m.totalOperations()) * 100;
        report.put("availability_pct", String.format("%.2f%%", availability));
        report.put("target_availability", "99.5%");
        report.put("meets_target", availability >= 99.5);

        return ResponseEntity.ok(report);
    }
}
