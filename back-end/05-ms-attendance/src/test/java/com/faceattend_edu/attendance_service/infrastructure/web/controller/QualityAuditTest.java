package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ISO 9001 quality audit: request metrics and the quality report")
class QualityAuditTest {

    private static void request(QualityAuditInterceptor interceptor, String method, String uri, int status) {
        MockHttpServletRequest req = new MockHttpServletRequest(method, uri);
        req.setRequestURI(uri);
        MockHttpServletResponse res = new MockHttpServletResponse();
        assertThat(interceptor.preHandle(req, res, new Object())).isTrue();
        res.setStatus(status);
        interceptor.afterCompletion(req, res, new Object(), null);
    }

    @Test
    void countsOperationsByKindAndClassifiesErrors() {
        QualityAuditInterceptor interceptor = new QualityAuditInterceptor();
        request(interceptor, "POST", "/api/v1/attendance-records", 201);
        request(interceptor, "GET", "/api/v1/attendance-records", 200);
        request(interceptor, "PUT", "/api/v1/attendance-records/1", 200);
        request(interceptor, "PATCH", "/api/v1/attendance-records/1", 400);
        request(interceptor, "DELETE", "/api/v1/attendance-records/1", 404);
        request(interceptor, "GET", "/api/v1/broken", 500);
        request(interceptor, "OPTIONS", "/api/v1/attendance-records", 403);
        request(interceptor, "GET", "/health", 200);

        QualityAuditInterceptor.QualityMetricsSnapshot m = interceptor.getMetrics();
        assertThat(m.totalOperations()).isEqualTo(8);
        assertThat(m.createCount()).isEqualTo(1);
        assertThat(m.readCount()).isEqualTo(2);
        assertThat(m.updateCount()).isEqualTo(2);
        assertThat(m.deleteCount()).isEqualTo(1);
        assertThat(m.clientErrors()).isEqualTo(3);
        assertThat(m.serverErrors()).isEqualTo(1);
        assertThat(m.errorRate()).isEqualTo(50.0);
        assertThat(m.avgResponseTimeMs()).isGreaterThanOrEqualTo(0.0);
    }

    @Test
    void afterCompletionWithoutPreHandleIsIgnored() {
        QualityAuditInterceptor interceptor = new QualityAuditInterceptor();
        interceptor.afterCompletion(new MockHttpServletRequest(), new MockHttpServletResponse(), new Object(), null);
        assertThat(interceptor.getMetrics().totalOperations()).isZero();
        assertThat(interceptor.getMetrics().errorRate()).isZero();
        assertThat(interceptor.getMetrics().avgResponseTimeMs()).isZero();
    }

    @Test
    @SuppressWarnings("unchecked")
    void theReportIsHealthyWithoutTrafficAndDegradedWithErrors() {
        QualityAuditInterceptor interceptor = new QualityAuditInterceptor();
        QualityHealthController controller = new QualityHealthController(interceptor);

        Map<String, Object> idle = controller.qualityReport().getBody();
        assertThat(idle).containsEntry("service", "05-ms-attendance").containsEntry("meets_target", true);
        assertThat((Map<String, Object>) idle.get("kpis")).containsEntry("availability_status", "HEALTHY");

        request(interceptor, "GET", "/api/v1/attendance-records", 500);
        Map<String, Object> failing = controller.qualityReport().getBody();
        assertThat((Map<String, Object>) failing.get("kpis")).containsEntry("availability_status", "DEGRADED");
        assertThat((Map<String, Object>) failing.get("error_classification")).containsEntry("server_errors_5xx", 1L);
        assertThat(failing).containsEntry("meets_target", false);
    }
}
