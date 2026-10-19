package com.faceattend_edu.identity_service.adapter.out.notification.email;

import com.faceattend_edu.identity_service.application.port.out.SendRecoveryEmailPort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Adaptador de salida hacia el canal de correo de 08-ms-notification.
 *
 * <p>Identity NO habla SMTP: genera el código y entrega el mensaje a
 * {@code POST /api/v1/emails} de notification, quien posee el transporte, las
 * plantillas y la configuración SMTP_* (SERVICE.md §8 de notification). La ruta
 * no está publicada en Kong: solo se alcanza por la red interna de compose.</p>
 */
@Slf4j
@Component
public class NotificationEmailAdapter implements SendRecoveryEmailPort {

    static final String TEMPLATE_VERIFICATION_CODE = "verification_code";
    static final String EMAILS_PATH = "/api/v1/emails";

    private final AuthProperties authProperties;
    private final RestTemplate restTemplate;

    public NotificationEmailAdapter(AuthProperties authProperties) {
        this.authProperties = authProperties;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    public boolean sendRecoveryCode(String to, String code, Duration ttl) {
        Map<String, Object> data = new HashMap<>();
        data.put("code", code);
        data.put("minutes", String.valueOf(Math.max(1, ttl.toMinutes())));

        Map<String, Object> payload = new HashMap<>();
        payload.put("to", to);
        payload.put("template", TEMPLATE_VERIFICATION_CODE);
        payload.put("data", data);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    URI.create(baseUrl() + EMAILS_PATH), HttpMethod.POST,
                    new HttpEntity<>(payload, headers()), Map.class);

            Object status = response.getBody() != null ? response.getBody().get("status") : null;
            if (!"accepted".equals(status)) {
                // notification respondió 202 "skipped": no hay relay configurado.
                log.warn("Email channel not delivering to={} status={}", to, status);
                return false;
            }
            return true;
        } catch (Exception ex) {
            log.warn("Email delivery failed to={} error={}", to, ex.getMessage());
            return false;
        }
    }

    private String baseUrl() {
        String base = authProperties.getNotificationBaseUrl();
        if (base == null || base.isBlank()) return "";
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private HttpHeaders headers() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String token = authProperties.getNotificationInternalToken();
        if (token != null && !token.isBlank()) {
            headers.set("X-Internal-Token", token);
        }
        return headers;
    }
}
