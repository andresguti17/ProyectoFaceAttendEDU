package com.faceattend_edu.attendance_service.infrastructure.web.security;

import com.faceattend_edu.attendance_service.domain.port.out.ArrivalTimingPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves the arrival timing over HTTP with the caller's own token: the class session and its block
 * (scheduling), the actor's school (academic) and that school's {@code tardy_tolerance_minutes}
 * (configuration). Results are cached for a minute because a kiosk checks in a whole class in a burst.
 */
@Component
public class RemoteArrivalTiming implements ArrivalTimingPort {

    static final String TOLERANCE_KEY = "tardy_tolerance_minutes";
    static final int DEFAULT_TOLERANCE_MINUTES = 15;
    private static final long TTL_MS = 60_000;
    private static final Logger log = LoggerFactory.getLogger(RemoteArrivalTiming.class);

    private record Cached<T>(T value, long expiresAt) {}

    private record SessionStart(LocalDate sessionDate, LocalTime startsAt) {}

    private final RestTemplate restTemplate;
    private final Map<Long, Cached<SessionStart>> sessions = new ConcurrentHashMap<>();
    private final Map<Long, Cached<Integer>> tolerances = new ConcurrentHashMap<>();
    private final Map<Long, Cached<Long>> actorSchools = new ConcurrentHashMap<>();

    @Value("${faceattend.auth.academic-url:http://localhost:8083}")
    private String academicUrl;

    @Value("${faceattend.auth.scheduling-url:http://localhost:8084}")
    private String schedulingUrl;

    @Value("${faceattend.auth.configuration-url:http://localhost:8087}")
    private String configurationUrl;

    public RemoteArrivalTiming() {
        this(buildRestTemplate());
    }

    RemoteArrivalTiming(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    private static RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2000);
        factory.setReadTimeout(4000);
        return new RestTemplate(factory);
    }

    @Override
    public Optional<Timing> find(Long classSessionId, Long academicActorId) {
        String token = CallerToken.current();
        if (token == null || classSessionId == null || academicActorId == null) return Optional.empty();
        try {
            SessionStart start = sessionStart(classSessionId, token);
            if (start == null) return Optional.empty();
            return Optional.of(new Timing(start.sessionDate(), start.startsAt(), tolerance(schoolOf(academicActorId, token), token)));
        } catch (RuntimeException e) {
            log.warn("Arrival timing for session {} actor {} unavailable, keeping the client status: {}",
                    classSessionId, academicActorId, e.getMessage());
            return Optional.empty();
        }
    }

    private SessionStart sessionStart(Long classSessionId, String token) {
        Cached<SessionStart> hit = sessions.get(classSessionId);
        if (hit != null && hit.expiresAt() > System.currentTimeMillis()) return hit.value();
        Map<?, ?> session = getMap(schedulingUrl + "/api/v1/class-sessions/" + classSessionId, token);
        Object blockId = session == null ? null : session.get("scheduleBlockId");
        Object date = session == null ? null : session.get("sessionDate");
        if (!(blockId instanceof Number) || date == null) return null;
        Map<?, ?> block = getMap(schedulingUrl + "/api/v1/schedule-blocks/" + ((Number) blockId).longValue(), token);
        Object startsAt = block == null ? null : block.get("startsAt");
        if (startsAt == null) return null;
        SessionStart start = new SessionStart(LocalDate.parse(String.valueOf(date)), LocalTime.parse(String.valueOf(startsAt)));
        sessions.put(classSessionId, new Cached<>(start, System.currentTimeMillis() + TTL_MS));
        return start;
    }

    private Long schoolOf(Long actorId, String token) {
        Cached<Long> hit = actorSchools.get(actorId);
        if (hit != null && hit.expiresAt() > System.currentTimeMillis()) return hit.value();
        Map<?, ?> actor = getMap(academicUrl + "/api/v1/academic-actors/" + actorId, token);
        Object school = actor == null ? null : actor.get("schoolId");
        Long schoolId = school instanceof Number n ? n.longValue() : null;
        actorSchools.put(actorId, new Cached<>(schoolId, System.currentTimeMillis() + TTL_MS));
        return schoolId;
    }

    private int tolerance(Long schoolId, String token) {
        if (schoolId == null) return DEFAULT_TOLERANCE_MINUTES;
        Cached<Integer> hit = tolerances.get(schoolId);
        if (hit != null && hit.expiresAt() > System.currentTimeMillis()) return hit.value();
        int minutes = DEFAULT_TOLERANCE_MINUTES;
        for (Map<?, ?> row : getList(configurationUrl + "/api/v1/schools/" + schoolId + "/configurations", token)) {
            if (!TOLERANCE_KEY.equals(row.get("configurationName"))) continue;
            try {
                minutes = Math.max(0, Integer.parseInt(String.valueOf(row.get("configurationValue")).trim()));
            } catch (NumberFormatException e) {
                log.warn("School {} has a non numeric {}: using {}", schoolId, TOLERANCE_KEY, DEFAULT_TOLERANCE_MINUTES);
            }
            break;
        }
        tolerances.put(schoolId, new Cached<>(minutes, System.currentTimeMillis() + TTL_MS));
        return minutes;
    }

    private HttpEntity<Void> auth(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }

    protected Map<?, ?> getMap(String url, String token) {
        return TransientRetry.call(() -> restTemplate.exchange(url, HttpMethod.GET, auth(token), Map.class).getBody());
    }

    @SuppressWarnings("unchecked")
    protected List<Map<?, ?>> getList(String url, String token) {
        List<Map<?, ?>> body = TransientRetry.call(
                () -> restTemplate.exchange(url, HttpMethod.GET, auth(token), List.class).getBody());
        return body == null ? List.of() : body;
    }
}
