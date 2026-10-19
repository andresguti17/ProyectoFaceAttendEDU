package com.faceattend_edu.attendance_service.infrastructure.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
@RequiredArgsConstructor
@Slf4j
public class DomainEventPublisher {

    private final KafkaTemplate<String, String> kafkaTemplate;

    /**
     * Publica cuando la transacción en curso confirma: si el cambio se revierte no sale un
     * evento fantasma. Sin transacción activa publica en el acto. Sin outbox, un Kafka caído
     * pierde el evento (igual que {@link #publish}).
     */
    public void publishAfterCommit(String topic, String key, String payload) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            send(topic, key, payload);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                send(topic, key, payload);
            }
        });
    }

    private void send(String topic, String key, String payload) {
        try {
            kafkaTemplate.send(topic, key, payload);
        } catch (Exception ex) {
            log.warn("Kafka publish failed topic={} key={} error={}", topic, key, ex.getMessage());
        }
    }

    public void publish(String topic, String payload) {
        try {
            kafkaTemplate.send(topic, payload);
        } catch (Exception ex) {
            log.warn("Kafka publish failed topic={} error={}", topic, ex.getMessage());
        }
    }
}
