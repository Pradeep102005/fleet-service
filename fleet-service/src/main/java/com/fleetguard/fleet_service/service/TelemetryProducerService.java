package com.fleetguard.fleet_service.service;

import com.fleetguard.fleet_service.dto.TelemetryEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class TelemetryProducerService {

    public static final String RAW_TOPIC = "telemetry.raw";
    public static final String CLEAN_TOPIC = "telemetry.clean";
    public static final String DLQ_TOPIC = "telemetry.dlq";
    public static final String ALERTS_TOPIC = "alerts";

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void sendRawEvent(TelemetryEvent event) {
        log.info("Publishing raw event for VIN: {}, seq: {}", event.vin(), event.seq());
        kafkaTemplate.send(RAW_TOPIC, event.vin(), event);
    }

    public void sendCleanEvent(TelemetryEvent event) {
        log.info("Publishing clean event for VIN: {}, seq: {}", event.vin(), event.seq());
        kafkaTemplate.send(CLEAN_TOPIC, event.vin(), event);
    }

    public void sendDlqEvent(Object rawPayload, String reason) {
        log.warn("Publishing event to DLQ. Reason: {}", reason);
        kafkaTemplate.send(DLQ_TOPIC, java.util.Map.of(
            "payload", rawPayload,
            "reason", reason,
            "timestamp", java.time.Instant.now()
        ));
    }

    public void sendAlert(Object alert) {
        log.info("Publishing alert to Kafka topic 'alerts'");
        kafkaTemplate.send(ALERTS_TOPIC, alert);
    }
}
