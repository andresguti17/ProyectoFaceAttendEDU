package com.faceattend_edu.attendance_service.infrastructure.peers;

import com.faceattend_edu.attendance_service.domain.exception.PeerUnavailableException;
import com.faceattend_edu.attendance_service.domain.exception.ValidationException;
import com.faceattend_edu.attendance_service.domain.model.ArrivalWindow;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** The links to scheduling and configuration that decide Present/Late on the server (N-14). */
class HttpArrivalWindowAdapterTest {

    private static final String SCHEDULING = "http://scheduling";
    private static final String CONFIGURATION = "http://configuration";

    private MockRestServiceServer server;
    private HttpArrivalWindowAdapter adapter;

    @BeforeEach
    void setUp() {
        RestTemplate rest = new RestTemplate();
        server = MockRestServiceServer.bindTo(rest).build();
        adapter = new HttpArrivalWindowAdapter(rest);
        adapter.schedulingUrl = SCHEDULING;
        adapter.configurationUrl = CONFIGURATION;
        adapter.zone = "America/Bogota";
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer kiosk-token");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    private void expectSessionBlockAndEnvironment() {
        server.expect(once(), requestTo(SCHEDULING + "/api/v1/class-sessions/10"))
                .andExpect(header("Authorization", "Bearer kiosk-token"))
                .andRespond(withSuccess("{\"classSessionId\":10,\"scheduleBlockId\":5,\"sessionDate\":\"2026-10-28\"}", MediaType.APPLICATION_JSON));
        server.expect(once(), requestTo(SCHEDULING + "/api/v1/schedule-blocks/5"))
                .andRespond(withSuccess("{\"scheduleBlockId\":5,\"environmentId\":3,\"startsAt\":\"07:00:00\"}", MediaType.APPLICATION_JSON));
        server.expect(once(), requestTo(SCHEDULING + "/api/v1/environments/3"))
                .andRespond(withSuccess("{\"environmentId\":3,\"schoolId\":2}", MediaType.APPLICATION_JSON));
    }

    private void expectConfiguration(String body) {
        server.expect(once(), requestTo(CONFIGURATION + "/api/v1/schools/2/configurations"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
    }

    @Test
    void buildsTheWindowFromTheSessionDateBlockStartAndSchoolTolerance() {
        expectSessionBlockAndEnvironment();
        expectConfiguration("[{\"configurationName\":\"min_attendance\",\"configurationValue\":\"80\"},"
                + "{\"configurationName\":\"tardy_tolerance_minutes\",\"configurationValue\":\"10\"}]");

        ArrivalWindow window = adapter.windowFor(10L);

        assertEquals(LocalDateTime.of(2026, 10, 28, 7, 0), window.startsAt());
        assertEquals(10, window.toleranceMinutes());
        // 07:10 Bogotá is 12:10Z: on time; 12:11Z is late.
        assertEquals("Present", window.statusAt(Instant.parse("2026-10-28T12:10:00Z")));
        assertEquals("Late", window.statusAt(Instant.parse("2026-10-28T12:11:00Z")));
        server.verify();
    }

    @Test
    void aSchoolWithoutAToleranceUsesTheDefault() {
        expectSessionBlockAndEnvironment();
        expectConfiguration("[]");

        assertEquals(HttpArrivalWindowAdapter.DEFAULT_TOLERANCE_MINUTES, adapter.windowFor(10L).toleranceMinutes());
    }

    @Test
    void anUnreadableToleranceFallsBackToTheDefault() {
        expectSessionBlockAndEnvironment();
        expectConfiguration("[{\"configurationName\":\"tardy_tolerance_minutes\",\"configurationValue\":\"quince\"}]");

        assertEquals(HttpArrivalWindowAdapter.DEFAULT_TOLERANCE_MINUTES, adapter.windowFor(10L).toleranceMinutes());
    }

    @Test
    void theWindowIsCachedForTheWholeClass() {
        expectSessionBlockAndEnvironment();
        expectConfiguration("[]");

        adapter.windowFor(10L);
        adapter.windowFor(10L);

        server.verify(); // each peer was asked exactly once
    }

    @Test
    void anUnknownSessionIsAValidationError() {
        server.expect(once(), requestTo(SCHEDULING + "/api/v1/class-sessions/10")).andRespond(withStatus(HttpStatus.NOT_FOUND));

        assertThrows(ValidationException.class, () -> adapter.windowFor(10L));
    }

    @Test
    void aSessionTheCallerCannotSeeIsAValidationError() {
        server.expect(once(), requestTo(SCHEDULING + "/api/v1/class-sessions/10")).andRespond(withStatus(HttpStatus.FORBIDDEN));

        assertThrows(ValidationException.class, () -> adapter.windowFor(10L));
    }

    @Test
    void aFailingSchedulingIsUnavailableNotAGuess() {
        server.expect(once(), requestTo(SCHEDULING + "/api/v1/class-sessions/10")).andRespond(withStatus(HttpStatus.BAD_GATEWAY));

        assertThrows(PeerUnavailableException.class, () -> adapter.windowFor(10L));
    }

    @Test
    void aFailingConfigurationIsUnavailable() {
        expectSessionBlockAndEnvironment();
        server.expect(once(), requestTo(CONFIGURATION + "/api/v1/schools/2/configurations"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertThrows(PeerUnavailableException.class, () -> adapter.windowFor(10L));
    }

    @Test
    void aBlockWithoutStartTimeIsAContractError() {
        server.expect(once(), requestTo(SCHEDULING + "/api/v1/class-sessions/10"))
                .andRespond(withSuccess("{\"scheduleBlockId\":5,\"sessionDate\":\"2026-10-28\"}", MediaType.APPLICATION_JSON));
        server.expect(once(), requestTo(SCHEDULING + "/api/v1/schedule-blocks/5"))
                .andRespond(withSuccess("{\"scheduleBlockId\":5,\"environmentId\":3}", MediaType.APPLICATION_JSON));

        assertThrows(PeerUnavailableException.class, () -> adapter.windowFor(10L));
    }

    @Test
    void withoutACallerTokenNothingIsQueried() {
        RequestContextHolder.resetRequestAttributes();

        assertThrows(PeerUnavailableException.class, () -> adapter.windowFor(10L));
        server.verify();
    }
}
