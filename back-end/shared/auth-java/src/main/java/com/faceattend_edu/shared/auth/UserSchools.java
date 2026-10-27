package com.faceattend_edu.shared.auth;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Schools a user belongs to: user -> person (identity) -> academic actors (academic).
 * A user has no school of its own; it comes from their academic_actor rows. Every call
 * carries the caller's token, so identity and academic apply the caller's own scope:
 * a user outside it simply has no visible school (empty set), never "every school".
 */
public class UserSchools {

    private final RestTemplate restTemplate;
    private final String identityUrl;
    private final String academicUrl;

    public UserSchools(String identityUrl, String academicUrl) {
        this(defaultRestTemplate(), identityUrl, academicUrl);
    }

    public UserSchools(RestTemplate restTemplate, String identityUrl, String academicUrl) {
        this.restTemplate = restTemplate;
        this.identityUrl = identityUrl;
        this.academicUrl = academicUrl;
    }

    private static RestTemplate defaultRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        return new RestTemplate(factory);
    }

    /**
     * School ids of `userId` as seen with `token`. Empty when the user has no person, no
     * actor, or lies outside the caller's scope (identity/academic answer 4xx).
     *
     * @throws org.springframework.web.client.RestClientException when a service cannot answer
     *         (the caller should fail with 503, never allow).
     */
    public Set<Integer> of(String userId, String token) {
        Map<?, ?> user;
        try {
            user = restTemplate.exchange(identityUrl + "/api/v1/users/" + encode(userId), HttpMethod.GET,
                    bearer(token), Map.class).getBody();
        } catch (HttpClientErrorException e) {
            return Set.of();
        }
        Object personId = user == null ? null : user.get("personId");
        if (personId == null) return Set.of();

        List<?> actors;
        try {
            actors = restTemplate.exchange(academicUrl + "/api/v1/academic-actors?personId=" + encode(String.valueOf(personId)),
                    HttpMethod.GET, bearer(token), List.class).getBody();
        } catch (HttpClientErrorException e) {
            return Set.of();
        }
        Set<Integer> schools = new HashSet<>();
        for (Object actor : actors == null ? List.of() : actors) {
            if (actor instanceof Map<?, ?> map && map.get("schoolId") instanceof Number n
                    && String.valueOf(personId).equalsIgnoreCase(String.valueOf(map.get("personId")))) {
                schools.add(n.intValue());
            }
        }
        return Set.copyOf(schools);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static HttpEntity<Void> bearer(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }
}
