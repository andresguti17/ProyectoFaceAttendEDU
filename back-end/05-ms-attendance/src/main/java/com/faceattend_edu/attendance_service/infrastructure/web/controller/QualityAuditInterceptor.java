package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * ISO/IEC 9001 — Quality Audit Interceptor (Cláusula 8.5.2 / 9.1)
 *
 * Registra cada operación CRUD con metadata completa para trazabilidad:
 * - correlationId único por request
 * - Timestamp de inicio y fin
 * - Duración de la operación
 * - Método HTTP y path
 * - Status code de respuesta
 * - Clasificación del resultado (éxito/error)
 *
 * Los registros se almacenan en memoria y se exponen vía /health/quality
 */
@Component
public class QualityAuditInterceptor implements HandlerInterceptor {

    private static final Logger auditLog = LoggerFactory.getLogger("QUALITY_AUDIT");

    private final ConcurrentHashMap<String, QualityMetrics> serviceMetrics = new ConcurrentHashMap<>();

    public QualityAuditInterceptor() {
        // Initialize metrics for this service
        serviceMetrics.put("attendance", new QualityMetrics());
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String correlationId = UUID.randomUUID().toString();
        long startTime = System.currentTimeMillis();
        request.setAttribute("quality.correlationId", correlationId);
        request.setAttribute("quality.startTime", startTime);
        request.setAttribute("quality.operation", classifyOperation(request.getMethod(), request.getRequestURI()));
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                 Object handler, Exception ex) {
        String correlationId = (String) request.getAttribute("quality.correlationId");
        Long startTime = (Long) request.getAttribute("quality.startTime");
        String operation = (String) request.getAttribute("quality.operation");

        if (startTime == null) return;

        long duration = System.currentTimeMillis() - startTime;
        int status = response.getStatus();
        String method = request.getMethod();
        String path = request.getRequestURI();
        boolean isError = status >= 400;

        // Update metrics
        QualityMetrics metrics = serviceMetrics.computeIfAbsent("attendance", k -> new QualityMetrics());
        metrics.totalOperations.incrementAndGet();
        metrics.totalDuration.addAndGet(duration);

        if (isError) {
            metrics.errorCount.incrementAndGet();
            if (status >= 500) {
                metrics.serverErrors.incrementAndGet();
            } else {
                metrics.clientErrors.incrementAndGet();
            }
        } else {
            metrics.successCount.incrementAndGet();
        }

        // Track CRUD operation counts
        switch (operation) {
            case "CREATE": metrics.createCount.incrementAndGet(); break;
            case "READ":   metrics.readCount.incrementAndGet(); break;
            case "UPDATE": metrics.updateCount.incrementAndGet(); break;
            case "DELETE": metrics.deleteCount.incrementAndGet(); break;
        }

        // Structured audit log entry
        String logEntry = String.format(
            "{\"correlationId\":\"%s\",\"timestamp\":\"%s\",\"service\":\"05-ms-attendance\"," +
            "\"method\":\"%s\",\"path\":\"%s\",\"status\":%d,\"duration\":%d," +
            "\"operation\":\"%s\",\"error\":%s,\"isoClause\":\"%s\"}",
            correlationId,
            Instant.now().toString(),
            method,
            path,
            status,
            duration,
            operation,
            isError,
            isError ? classifyISOClause(status) : "N/A"
        );

        if (isError) {
            auditLog.error("QUALITY_AUDIT_ERROR {}", logEntry);
        } else {
            auditLog.info("QUALITY_AUDIT {}", logEntry);
        }
    }

    /**
     * Clasifica la operación CRUD según el método HTTP
     */
    private String classifyOperation(String method, String uri) {
        if (uri.contains("/health")) return "HEALTH";
        if (uri.contains("/quality")) return "METRICS";

        switch (method) {
            case "POST":   return "CREATE";
            case "GET":    return "READ";
            case "PUT":
            case "PATCH":  return "UPDATE";
            case "DELETE": return "DELETE";
            default:       return "OTHER";
        }
    }

    /**
     * Clasifica la cláusula ISO según el status code (ISO/IEC 9001 Cl. 10.2)
     */
    private String classifyISOClause(int status) {
        if (status == 400) return "8.2";  // Requisitos — validación
        if (status == 401 || status == 403) return "8.5";  // Producción — auth
        if (status == 404) return "8.5";  // Producción — no encontrado
        if (status == 409) return "8.5";  // Producción — duplicado
        if (status >= 500) return "10.2"; // No conformidad
        return "9.1";  // Medición
    }

    /**
     * Obtener métricas acumuladas del servicio
     */
    public QualityMetricsSnapshot getMetrics() {
        QualityMetrics m = serviceMetrics.getOrDefault("attendance", new QualityMetrics());
        return new QualityMetricsSnapshot(
            m.totalOperations.get(),
            m.successCount.get(),
            m.errorCount.get(),
            m.clientErrors.get(),
            m.serverErrors.get(),
            m.createCount.get(),
            m.readCount.get(),
            m.updateCount.get(),
            m.deleteCount.get(),
            m.totalDuration.get()
        );
    }

    /**
     * Métricas internas concurrentes
     */
    static class QualityMetrics {
        final AtomicLong totalOperations = new AtomicLong(0);
        final AtomicLong successCount = new AtomicLong(0);
        final AtomicLong errorCount = new AtomicLong(0);
        final AtomicLong clientErrors = new AtomicLong(0);
        final AtomicLong serverErrors = new AtomicLong(0);
        final AtomicLong createCount = new AtomicLong(0);
        final AtomicLong readCount = new AtomicLong(0);
        final AtomicLong updateCount = new AtomicLong(0);
        final AtomicLong deleteCount = new AtomicLong(0);
        final AtomicLong totalDuration = new AtomicLong(0);
    }

    /**
     * Snapshot de métricas para exposición externa
     */
    public record QualityMetricsSnapshot(
        long totalOperations,
        long successCount,
        long errorCount,
        long clientErrors,
        long serverErrors,
        long createCount,
        long readCount,
        long updateCount,
        long deleteCount,
        long totalDurationMs
    ) {
        public double errorRate() {
            return totalOperations == 0 ? 0.0 : (double) errorCount / totalOperations * 100;
        }
        public double avgResponseTimeMs() {
            return totalOperations == 0 ? 0.0 : (double) totalDurationMs / totalOperations;
        }
    }
}
