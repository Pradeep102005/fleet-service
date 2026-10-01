package com.fleetguard.fleet_service.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleetguard.fleet_service.dto.TelemetryEvent;
import com.fleetguard.fleet_service.service.TelemetryProducerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
@Slf4j
public class TelemetryNormalizationConsumer {

    private static final Pattern VIN_PATTERN = Pattern.compile("^[A-HJ-NPR-Z0-9]{17}$");
    private final StringRedisTemplate redisTemplate;
    private final TelemetryProducerService producerService;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = TelemetryProducerService.RAW_TOPIC, groupId = "normalization-group")
    public void consumeRawEvent(TelemetryEvent event) {
        log.info("Received raw telemetry event for VIN: {}, seq: {}", event.vin(), event.seq());

        // 1. Validation check (Defense in depth)
        String validationReason = validateEvent(event);
        if (validationReason != null) {
            log.warn("Validation failed for event [VIN: {}, seq: {}]: {}", event.vin(), event.seq(), validationReason);
            producerService.sendDlqEvent(event, validationReason);
            return;
        }

        // 2. Deduplication check via Redis SETNX with 5-minute TTL
        String dedupKey = String.format("dedup:event:%s:%d", event.vin(), event.seq());
        Boolean isNewEvent = redisTemplate.opsForValue().setIfAbsent(dedupKey, "1", Duration.ofMinutes(5));

        if (Boolean.FALSE.equals(isNewEvent)) {
            log.info("Duplicate event detected for VIN: {}, seq: {}. Dropping event.", event.vin(), event.seq());
            return;
        }

        // 3. Publish to telemetry.clean
        log.info("Event validated and deduplicated. Forwarding to telemetry.clean for VIN: {}", event.vin());
        producerService.sendCleanEvent(event);
    }

    private String validateEvent(TelemetryEvent event) {
        if (event == null) {
            return "Event payload is null";
        }
        if (event.vin() == null || !VIN_PATTERN.matcher(event.vin()).matches()) {
            return "Invalid VIN format: " + event.vin();
        }
        if (event.ts() == null) {
            return "Missing timestamp";
        }
        if (isInvalid(event.lat()) || isInvalid(event.lon())) {
            return "Invalid latitude/longitude coordinates";
        }
        if (isInvalid(event.speedKmh()) || event.speedKmh() < 0) {
            return "Invalid speedKmh value";
        }
        if (isInvalid(event.engineTempC())) {
            return "Invalid engineTempC value";
        }
        if (isInvalid(event.batteryV()) || event.batteryV() < 0) {
            return "Invalid batteryV value";
        }
        if (isInvalid(event.socPct()) || event.socPct() < 0 || event.socPct() > 100) {
            return "Invalid socPct value";
        }
        if (isInvalid(event.odoKm()) || event.odoKm() < 0) {
            return "Invalid odoKm value";
        }
        if (event.evt() == null) {
            return "Missing event type (evt)";
        }
        if (event.seq() == null || event.seq() < 0) {
            return "Invalid sequence number (seq)";
        }
        return null;
    }

    private boolean isInvalid(Double val) {
        return val == null || val.isNaN() || val.isInfinite();
    }
}
