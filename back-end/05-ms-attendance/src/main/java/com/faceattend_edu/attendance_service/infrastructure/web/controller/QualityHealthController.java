package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * ISO/IEC 9001 — Quality Health Endpoint (Cláusula 9.1)
 *
 * Endpoint que expone las métricas de calidad del servicio CRUD.
 * Cumple con la cláusula 9.1 de seguimiento, medición, análisis y evaluación.
 *
 * GET /health/quality
 * GET /api/v1/quality/report
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
        QualityAuditInterceptor.QualityMetricsSnapshot metrics = auditInterceptor.getMetrics();

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("service", "05-ms-attendance");
        report.put("timestamp", Instant.now().toString());
        report.put("iso_compliance", "ISO/IEC 9001:2015");

        // KPIs (Cláusula 9.1)
        Map<String, Object> kpis = new LinkedHashMap<>();
        kpis.put("total_operations", metrics.totalOperations());
        kpis.put("success_count", metrics.successCount());
        kpis.put("error_count", metrics.errorCount());
        kpis.put("error_rate_pct", String.format("%.2f%%", metrics.errorRate()));
        kpis.put("avg_response_time_ms", String.format("%.2f", metrics.avgResponseTimeMs()));
        kpis.put("availability_status", metrics.errorRate() < 1.0 ? "HEALTHY" : "DEGRADED");
        report.put("kpis", kpis);

        // CRUD breakdown (Cláusula 8.5.2)
        Map<String, Object> crudBreakdown = new LinkedHashMap<>();
        crudBreakdown.put("creates", metrics.createCount());
        crudBreakdown.put("reads", metrics.readCount());
        crudBreakdown.put("updates", metrics.updateCount());
        crudBreakdown.put("deletes", metrics.deleteCount());
        report.put("crud_operations", crudBreakdown);

        // Error classification (Cláusula 10.2)
        Map<String, Object> errorClassification = new LinkedHashMap<>();
        errorClassification.put("client_errors_4xx", metrics.clientErrors());
        errorClassification.put("server_errors_5xx", metrics.serverErrors());
        errorClassification.put("total_errors", metrics.errorCount());
        report.put("error_classification", errorClassification);

        // ISO compliance summary
        Map<String, Object> compliance = new LinkedHashMap<>();
        compliance.put("clause_4_4_context", "ACTIVE");
        compliance.put("clause_8_2_requirements", "ACTIVE");
        compliance.put("clause_8_5_production", "ACTIVE");
        compliance.put("clause_9_1_measurement", "ACTIVE");
        compliance.put("clause_10_2_corrective", "ACTIVE");
        compliance.put("clause_7_5_documentation", "ACTIVE");
        report.put("iso_clauses_status", compliance);

        // Availability KPI
        double availability = metrics.totalOperations() == 0
            ? 100.0
            : ((double) metrics.successCount() / metrics.totalOperations()) * 100;
        report.put("availability_pct", String.format("%.2f%%", availability));
        report.put("target_availability", "99.5%");
        report.put("meets_target", availability >= 99.5);

        return ResponseEntity.ok(report);
    }
}
