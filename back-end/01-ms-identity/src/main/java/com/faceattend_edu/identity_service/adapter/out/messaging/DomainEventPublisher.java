package com.faceattend_edu.identity_service.adapter.out.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DomainEventPublisher {

    private final KafkaTemplate<String, String> kafkaTemplate;

    public void publish(String topic, String payload) {
        try {
            kafkaTemplate.send(topic, payload);
        } catch (Exception ex) {
            log.warn("Kafka publish failed topic={} error={}", topic, ex.getMessage());
        }
    }
}
