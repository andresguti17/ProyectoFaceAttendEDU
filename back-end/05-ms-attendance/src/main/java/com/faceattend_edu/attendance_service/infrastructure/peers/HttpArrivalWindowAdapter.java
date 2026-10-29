package com.faceattend_edu.attendance_service.infrastructure.peers;

import com.faceattend_edu.attendance_service.domain.exception.PeerUnavailableException;
import com.faceattend_edu.attendance_service.domain.exception.ValidationException;
import com.faceattend_edu.attendance_service.domain.model.ArrivalWindow;
import com.faceattend_edu.attendance_service.domain.port.out.ArrivalWindowPort;
import com.faceattend_edu.attendance_service.infrastructure.web.security.TransientRetry;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves a class session's start (scheduling: session date + block start time) and its
 * school's tardy_tolerance_minutes (configuration), with the caller's own bearer, so the
 * caller only ever reads a session it may already see. Cached per session for a minute:
 * a kiosk records a whole class against the same session.
 */
@Component
public class HttpArrivalWindowAdapter implements ArrivalWindowPort {

    private static final Logger log = LoggerFactory.getLogger(HttpArrivalWindowAdapter.class);

    static final String TOLERANCE_KEY = "tardy_tolerance_minutes";
    /** Same default as the configuration seed and the web settings screen. */
    static final int DEFAULT_TOLERANCE_MINUTES = 15;
    private static final long TTL_MS = 60_000;
    private static final int MAX_CACHED = 1_000;

    private record Cached(ArrivalWindow window, long expiresAt) {}

    private final RestTemplate restTemplate;
    private final Map<Long, Cached> cache = new ConcurrentHashMap<>();

    @Value("${faceattend.auth.scheduling-url:http://localhost:8084}")
    String schedulingUrl;

    @Value("${faceattend.auth.configuration-url:http://localhost:8087}")
    String configurationUrl;

    /** School local time of the schedule blocks (they are stored as TIME without zone). */
    @Value("${faceattend.attendance.zone:America/Bogota}")
    String zone;

    public HttpArrivalWindowAdapter() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
    }

    HttpArrivalWindowAdapter(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Override
    public ArrivalWindow windowFor(Long classSessionId) {
        Cached hit = cache.get(classSessionId);
        if (hit != null && hit.expiresAt() > System.currentTimeMillis()) return hit.window();

        String token = callerToken();
        Map<?, ?> session = sessionOrReject(classSessionId, token);
        LocalDate date = LocalDate.parse(required(session, "sessionDate", "class session"));
        Map<?, ?> block = peer(schedulingUrl + "/api/v1/schedule-blocks/" + required(session, "scheduleBlockId", "class session"), token);
        LocalTime startsAt = LocalTime.parse(required(block, "startsAt", "schedule block"));
        Map<?, ?> environment = peer(schedulingUrl + "/api/v1/environments/" + required(block, "environmentId", "schedule block"), token);
        int tolerance = toleranceOf(required(environment, "schoolId", "environment"), token);

        ArrivalWindow window = new ArrivalWindow(LocalDateTime.of(date, startsAt), tolerance, ZoneId.of(zone));
        if (cache.size() >= MAX_CACHED) cache.values().removeIf(c -> c.expiresAt() <= System.currentTimeMillis());
        cache.put(classSessionId, new Cached(window, System.currentTimeMillis() + TTL_MS));
        return window;
    }

    private Map<?, ?> sessionOrReject(Long classSessionId, String token) {
        try {
            return peer(schedulingUrl + "/api/v1/class-sessions/" + classSessionId, token);
        } catch (PeerUnavailableException ex) {
            if (ex.getCause() instanceof HttpStatusCodeException http
                    && (http.getStatusCode() == HttpStatus.NOT_FOUND || http.getStatusCode() == HttpStatus.FORBIDDEN)) {
                throw new ValidationException("classSessionId " + classSessionId + " does not exist or is not accessible");
            }
            throw ex;
        }
    }

    private int toleranceOf(String schoolId, String token) {
        for (Map<?, ?> row : peerList(configurationUrl + "/api/v1/schools/" + schoolId + "/configurations", token)) {
            if (!TOLERANCE_KEY.equals(row.get("configurationName"))) continue;
            Object value = row.get("configurationValue");
            try {
                int minutes = Integer.parseInt(String.valueOf(value).trim());
                if (minutes >= 0) return minutes;
            } catch (NumberFormatException ignored) {
                // falls through to the warning below
            }
            log.warn("School {} has an invalid {} ({}); using {} minutes", schoolId, TOLERANCE_KEY, value, DEFAULT_TOLERANCE_MINUTES);
            return DEFAULT_TOLERANCE_MINUTES;
        }
        return DEFAULT_TOLERANCE_MINUTES;
    }

    private static String required(Map<?, ?> body, String field, String what) {
        Object value = body == null ? null : body.get(field);
        if (value == null) throw new PeerUnavailableException(what + " response has no " + field, null);
        return String.valueOf(value);
    }

    private static String callerToken() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            HttpServletRequest request = attrs.getRequest();
            String header = request.getHeader(HttpHeaders.AUTHORIZATION);
            if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) return header.substring(7).trim();
        }
        throw new PeerUnavailableException("No caller token to query scheduling with", null);
    }

    private HttpEntity<Void> auth(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }

    private Map<?, ?> peer(String url, String token) {
        try {
            return TransientRetry.call(() -> restTemplate.exchange(url, HttpMethod.GET, auth(token), Map.class).getBody());
        } catch (RestClientException ex) {
            throw new PeerUnavailableException("GET " + url + " failed: " + ex.getMessage(), ex);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<?, ?>> peerList(String url, String token) {
        try {
            List<Map<?, ?>> body = TransientRetry.call(() -> restTemplate.exchange(url, HttpMethod.GET, auth(token), List.class).getBody());
            return body == null ? List.of() : body;
        } catch (RestClientException ex) {
            throw new PeerUnavailableException("GET " + url + " failed: " + ex.getMessage(), ex);
        }
    }
}
