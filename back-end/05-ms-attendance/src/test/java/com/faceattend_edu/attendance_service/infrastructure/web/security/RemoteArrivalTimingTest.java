package com.faceattend_edu.attendance_service.infrastructure.web.security;

import com.faceattend_edu.attendance_service.domain.port.out.ArrivalTimingPort;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Where the arrival timing of N-14 comes from: scheduling (session and block), academic (school) and configuration. */
class RemoteArrivalTimingTest {

    private final Map<String, Map<?, ?>> maps = new HashMap<>();
    private final Map<String, List<Map<?, ?>>> lists = new HashMap<>();
    private final List<String> calls = new ArrayList<>();
    private RemoteArrivalTiming timing;

    @BeforeEach
    void setUp() {
        timing = new RemoteArrivalTiming() {
            @Override protected Map<?, ?> getMap(String url, String token) {
                calls.add(url + " as " + token);
                if (!maps.containsKey(url)) throw new IllegalStateException("scheduling is down");
                return maps.get(url);
            }
            @Override protected List<Map<?, ?>> getList(String url, String token) {
                calls.add(url + " as " + token);
                return lists.getOrDefault(url, List.of());
            }
        };
        ReflectionTestUtils.setField(timing, "academicUrl", "http://academic");
        ReflectionTestUtils.setField(timing, "schedulingUrl", "http://scheduling");
        ReflectionTestUtils.setField(timing, "configurationUrl", "http://configuration");

        maps.put("http://scheduling/api/v1/class-sessions/5", Map.of("scheduleBlockId", 9, "sessionDate", "2026-10-21"));
        maps.put("http://scheduling/api/v1/schedule-blocks/9", Map.of("startsAt", "07:00:00"));
        maps.put("http://academic/api/v1/academic-actors/20", Map.of("schoolId", 3));
        lists.put("http://configuration/api/v1/schools/3/configurations", List.of(
                Map.of("configurationName", "web.facial_confidence", "configurationValue", "85"),
                Map.of("configurationName", "tardy_tolerance_minutes", "configurationValue", "10")));
        signIn("caller-token");
    }

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    private static void signIn(String token) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(CallerToken.ATTRIBUTE, token);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @Test
    void resolvesTheBlockStartTheSessionDayAndTheSchoolTolerance() {
        Optional<ArrivalTimingPort.Timing> found = timing.find(5L, 20L);

        assertEquals(Optional.of(new ArrivalTimingPort.Timing(LocalDate.of(2026, 10, 21), LocalTime.of(7, 0), 10)), found);
        assertTrue(calls.stream().allMatch(call -> call.endsWith(" as caller-token")), "calls use the caller's own token");
    }

    @Test
    void usesFifteenMinutesWhenTheSchoolHasNoToleranceOrItIsNotANumber() {
        lists.put("http://configuration/api/v1/schools/3/configurations", List.of());
        assertEquals(15, timing.find(5L, 20L).orElseThrow().toleranceMinutes());

        maps.put("http://academic/api/v1/academic-actors/21", Map.of("schoolId", 4));
        lists.put("http://configuration/api/v1/schools/4/configurations",
                List.of(Map.of("configurationName", "tardy_tolerance_minutes", "configurationValue", "pronto")));
        assertEquals(15, timing.find(5L, 21L).orElseThrow().toleranceMinutes());
    }

    @Test
    void cachesWhatItAlreadyAskedSoACheckInBurstDoesNotRepeatTheCalls() {
        timing.find(5L, 20L);
        int firstRound = calls.size();
        timing.find(5L, 20L);
        assertEquals(firstRound, calls.size());
    }

    @Test
    void isEmptyWithoutACallerToken() {
        RequestContextHolder.resetRequestAttributes();
        assertTrue(timing.find(5L, 20L).isEmpty());
        assertTrue(calls.isEmpty());
    }

    @Test
    void isEmptyWhenTheSessionHasNoBlockOrADownstreamServiceFails() {
        maps.put("http://scheduling/api/v1/class-sessions/6", Map.of("sessionDate", "2026-10-21"));
        assertTrue(timing.find(6L, 20L).isEmpty());

        assertTrue(timing.find(404L, 20L).isEmpty(), "a service that is down never blocks a check-in");
    }

    @Test
    void ignoresIncompleteRequests() {
        assertTrue(timing.find(null, 20L).isEmpty());
        assertTrue(timing.find(5L, null).isEmpty());
    }
}
