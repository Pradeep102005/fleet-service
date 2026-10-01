package com.fleetguard.fleet_service.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleetguard.fleet_service.dto.TelemetryEvent;
import com.fleetguard.fleet_service.service.TelemetryProducerService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/telemetry")
@RequiredArgsConstructor
@Slf4j
public class TelemetryIngestionController {

    private final TelemetryProducerService producerService;
    private final Validator validator;
    private final ObjectMapper objectMapper;

    @PostMapping("/ingest")
    public ResponseEntity<?> ingestTelemetry(@RequestBody String rawJsonPayload) {
        List<TelemetryEvent> events = new ArrayList<>();
        try {
            if (rawJsonPayload.trim().startsWith("[")) {
                List<TelemetryEvent> batch = objectMapper.readValue(rawJsonPayload, new TypeReference<List<TelemetryEvent>>() {});
                events.addAll(batch);
            } else {
                TelemetryEvent single = objectMapper.readValue(rawJsonPayload, TelemetryEvent.class);
                events.add(single);
            }
        } catch (Exception e) {
            log.error("Failed to parse telemetry JSON payload: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Invalid JSON format", "details", e.getMessage()));
        }

        List<String> validationErrors = new ArrayList<>();
        for (int i = 0; i < events.size(); i++) {
            TelemetryEvent event = events.get(i);
            Set<ConstraintViolation<TelemetryEvent>> violations = validator.validate(event);
            if (!violations.isEmpty()) {
                for (ConstraintViolation<TelemetryEvent> violation : violations) {
                    validationErrors.add(String.format("Item [%d] %s: %s", i, violation.getPropertyPath(), violation.getMessage()));
                }
            }
        }

        if (!validationErrors.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Validation failed", "details", validationErrors));
        }

        for (TelemetryEvent event : events) {
            producerService.sendRawEvent(event);
        }

        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(Map.of("status", "ACCEPTED", "ingestedCount", events.size()));
    }
}
