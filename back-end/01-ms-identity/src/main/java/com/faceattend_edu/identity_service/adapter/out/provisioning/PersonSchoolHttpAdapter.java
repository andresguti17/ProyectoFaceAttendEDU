package com.faceattend_edu.identity_service.adapter.out.provisioning;

import com.faceattend_edu.identity_service.application.port.out.PersonSchoolPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Resolves the school of a person from their academic actors (03-ms-academic). */
@Component
public class PersonSchoolHttpAdapter implements PersonSchoolPort {

    private static final Logger log = LoggerFactory.getLogger(PersonSchoolHttpAdapter.class);

    private final RestTemplate restTemplate;

    @Value("${faceattend.auth.academic-url:http://localhost:8083}")
    private String academicUrl;

    public PersonSchoolHttpAdapter() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<Long> schoolOf(String bearer, UUID personId) {
        if (bearer == null || personId == null) return Optional.empty();
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(bearer);
            List<Map<String, Object>> actors = restTemplate.exchange(
                    academicUrl + "/api/v1/academic-actors?personId=" + personId,
                    HttpMethod.GET, new HttpEntity<>(headers), List.class).getBody();
            if (actors == null) return Optional.empty();
            return actors.stream()
                    .map(a -> a.get("schoolId"))
                    .filter(Number.class::isInstance)
                    .map(id -> ((Number) id).longValue())
                    .findFirst();
        } catch (RuntimeException e) {
            // The audit row is still written; only the school column stays empty.
            log.warn("Could not resolve the school of person {}: {}", personId, e.getMessage());
            return Optional.empty();
        }
    }
}
