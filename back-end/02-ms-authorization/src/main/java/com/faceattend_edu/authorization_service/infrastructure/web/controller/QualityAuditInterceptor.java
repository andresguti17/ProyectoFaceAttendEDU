package com.faceattend_edu.authorization_service.infrastructure.web.controller;

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
 * Authorization Service — Misma estructura que 05-ms-attendance para consistencia ISO.
 */
@Component
public class QualityAuditInterceptor implements HandlerInterceptor {

    private static final Logger auditLog = LoggerFactory.getLogger("QUALITY_AUDIT");
    private final ConcurrentHashMap<String, QualityMetrics> serviceMetrics = new ConcurrentHashMap<>();

    public QualityAuditInterceptor() {
        serviceMetrics.put("authorization", new QualityMetrics());
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute("quality.correlationId", UUID.randomUUID().toString());
        request.setAttribute("quality.startTime", System.currentTimeMillis());
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
        boolean isError = status >= 400;

        QualityMetrics m = serviceMetrics.computeIfAbsent("authorization", k -> new QualityMetrics());
        m.totalOperations.incrementAndGet();
        m.totalDuration.addAndGet(duration);
        if (isError) { m.errorCount.incrementAndGet(); if (status >= 500) m.serverErrors.incrementAndGet(); else m.clientErrors.incrementAndGet(); }
        else m.successCount.incrementAndGet();

        switch (operation) {
            case "CREATE": m.createCount.incrementAndGet(); break;
            case "READ":   m.readCount.incrementAndGet(); break;
            case "UPDATE": m.updateCount.incrementAndGet(); break;
            case "DELETE": m.deleteCount.incrementAndGet(); break;
        }

        String logEntry = String.format(
            "{\"correlationId\":\"%s\",\"timestamp\":\"%s\",\"service\":\"02-ms-authorization\"," +
            "\"method\":\"%s\",\"path\":\"%s\",\"status\":%d,\"duration\":%d," +
            "\"operation\":\"%s\",\"error\":%s,\"isoClause\":\"%s\"}",
            correlationId, Instant.now().toString(), request.getMethod(), request.getRequestURI(),
            status, duration, operation, isError, isError ? classifyISOClause(status) : "N/A"
        );

        if (isError) auditLog.error("QUALITY_AUDIT_ERROR {}", logEntry);
        else auditLog.info("QUALITY_AUDIT {}", logEntry);
    }

    private String classifyOperation(String method, String uri) {
        if (uri.contains("/health")) return "HEALTH";
        switch (method) {
            case "POST": return "CREATE"; case "GET": return "READ";
            case "PUT": case "PATCH": return "UPDATE"; case "DELETE": return "DELETE";
            default: return "OTHER";
        }
    }

    private String classifyISOClause(int status) {
        if (status == 400) return "8.2";
        if (status == 401 || status == 403) return "8.5";
        if (status == 404 || status == 409) return "8.5";
        if (status >= 500) return "10.2";
        return "9.1";
    }

    public QualityMetricsSnapshot getMetrics() {
        QualityMetrics m = serviceMetrics.getOrDefault("authorization", new QualityMetrics());
        return new QualityMetricsSnapshot(m.totalOperations.get(), m.successCount.get(), m.errorCount.get(),
            m.clientErrors.get(), m.serverErrors.get(), m.createCount.get(), m.readCount.get(),
            m.updateCount.get(), m.deleteCount.get(), m.totalDuration.get());
    }

    static class QualityMetrics {
        final AtomicLong totalOperations = new AtomicLong(0), successCount = new AtomicLong(0),
            errorCount = new AtomicLong(0), clientErrors = new AtomicLong(0), serverErrors = new AtomicLong(0),
            createCount = new AtomicLong(0), readCount = new AtomicLong(0), updateCount = new AtomicLong(0),
            deleteCount = new AtomicLong(0), totalDuration = new AtomicLong(0);
    }

    public record QualityMetricsSnapshot(long totalOperations, long successCount, long errorCount,
        long clientErrors, long serverErrors, long createCount, long readCount, long updateCount,
        long deleteCount, long totalDurationMs) {
        public double errorRate() { return totalOperations == 0 ? 0.0 : (double) errorCount / totalOperations * 100; }
        public double avgResponseTimeMs() { return totalOperations == 0 ? 0.0 : (double) totalDurationMs / totalOperations; }
    }
}
