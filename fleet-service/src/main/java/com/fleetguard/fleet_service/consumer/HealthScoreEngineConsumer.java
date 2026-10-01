package com.fleetguard.fleet_service.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleetguard.fleet_service.dto.*;
import com.fleetguard.fleet_service.entity.*;
import com.fleetguard.fleet_service.repository.AlertRepository;
import com.fleetguard.fleet_service.repository.VehicleRepository;
import com.fleetguard.fleet_service.scorer.RiskScorer;
import com.fleetguard.fleet_service.service.TelemetryProducerService;
import com.fleetguard.fleet_service.entity.mongo.TelemetryDocument;
import com.fleetguard.fleet_service.repository.mongo.TelemetryMongoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class HealthScoreEngineConsumer {

    private static final double ALPHA = 0.2;
    private static final String ROLLING_KEY_PREFIX = "vehicle:rolling:";
    private static final String HEALTH_KEY_PREFIX = "vehicle:health:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final RiskScorer riskScorer;
    private final VehicleRepository vehicleRepository;
    private final AlertRepository alertRepository;
    private final TelemetryProducerService producerService;
    private final TelemetryMongoRepository mongoRepository;

    @KafkaListener(topics = TelemetryProducerService.CLEAN_TOPIC, groupId = "health-engine-group")
    @Transactional
    public void consumeCleanEvent(TelemetryEvent event) {
        log.info("Processing clean telemetry event for VIN: {}", event.vin());

        // Save raw telemetry to MongoDB (Polyglot Dynamic Document Store)
        try {
            mongoRepository.save(TelemetryDocument.builder()
                    .vin(event.vin())
                    .timestamp(event.ts() != null ? LocalDateTime.ofInstant(event.ts(), java.time.ZoneId.systemDefault()) : LocalDateTime.now())
                    .speed(event.speedKmh())
                    .latitude(event.lat())
                    .longitude(event.lon())
                    .batterySoc(event.socPct())
                    .engineTemperature(event.engineTempC())
                    .engineRpm(event.engineRpm())
                    .oilPressure(event.oilPressureBar())
                    .brakeTemperature(event.brakeTempC())
                    .coolantTemperature(event.coolantTempC())
                    .voltage(event.batteryV())
                    .dtc(event.dtc())
                    .event(event.evt() != null ? event.evt().name() : "NORMAL")
                    .odometer(event.odoKm())
                    .sequence(event.seq())
                    .build());
        } catch (Exception e) {
            log.warn("Non-blocking MongoDB save warning: {}", e.getMessage());
        }



        // 1. Read existing rolling stats from Redis
        String rollingKey = ROLLING_KEY_PREFIX + event.vin();
        RollingStats stats = readRollingStatsFromRedis(rollingKey);

        // 2. Compute EWMA updates (alpha = 0.2)
        double currentTemp = event.engineTempC();
        double updatedTempEwma = (stats.getEngineTempEwma() == null)
                ? currentTemp
                : ALPHA * currentTemp + (1.0 - ALPHA) * stats.getEngineTempEwma();
        stats.setLastEngineTemp(currentTemp);
        stats.setEngineTempEwma(updatedTempEwma);

        double currentBattery = event.batteryV();
        double updatedBatteryEwma = (stats.getBatteryVEwma() == null)
                ? currentBattery
                : ALPHA * currentBattery + (1.0 - ALPHA) * stats.getBatteryVEwma();
        stats.setLastBatteryV(currentBattery);
        stats.setBatteryVEwma(updatedBatteryEwma);

        stats.setLat(event.lat());
        stats.setLon(event.lon());
        stats.setLastSpeed(event.speedKmh());
        stats.setLastSocPct(event.socPct());
        stats.setLastOdoKm(event.odoKm());

        int currentDtcCount = (event.dtc() != null) ? event.dtc().size() : 0;
        stats.addDtcCountWindow(currentDtcCount);

        // Save updated rolling stats to Redis
        writeToRedis(rollingKey, stats, null);

        // 3. Score vehicle health using RiskScorer interface
        RiskScoreResult riskResult = riskScorer.score(stats, event);

        String healthStatus = "HEALTHY";
        if (riskResult.getOverallScore() >= 0.75) {
            healthStatus = "CRITICAL";
        } else if (riskResult.getOverallScore() >= 0.50) {
            healthStatus = "WARNING";
        }

        VehicleHealth health = VehicleHealth.builder()
                .vin(event.vin())
                .overallRiskScore(riskResult.getOverallScore())
                .status(healthStatus)
                .engineRisk(riskResult.getEngineRisk())
                .batteryRisk(riskResult.getBatteryRisk())
                .brakesRisk(riskResult.getBrakesRisk())
                .coolingRisk(riskResult.getCoolingRisk())
                .anomalyScore(riskResult.getAnomalyScore())
                .primarySubsystem(riskResult.getPrimarySubsystem())
                .rollingStats(stats)
                .lat(event.lat())
                .lon(event.lon())
                .updatedAt(Instant.now())
                .failureProbabilities(riskResult.getFailureProbabilities())
                .rulInfo(riskResult.getRulInfo())
                .xaiContributions(riskResult.getXaiContributions())
                .build();

        // 4. Write health blob to Redis key "vehicle:health:{vin}" (TTL 120s)
        String healthKey = HEALTH_KEY_PREFIX + event.vin();
        writeToRedis(healthKey, health, Duration.ofSeconds(120));

        // 5. Check if alert creation threshold is crossed (> 0.6)
        if (riskResult.getOverallScore() > 0.60) {
            handleAlertCreation(event, health, riskResult);
        }
    }

    private void handleAlertCreation(TelemetryEvent event, VehicleHealth health, RiskScoreResult riskResult) {
        // Ensure vehicle exists in DB (or create default placeholder if missing)
        Vehicle vehicle = vehicleRepository.findByVin(event.vin())
                .orElseGet(() -> vehicleRepository.save(Vehicle.builder()
                        .vin(event.vin())
                        .make("Unknown")
                        .model("Unknown")
                        .year(2024)
                        .mileageKm(event.odoKm())
                        .build()));

        Subsystem subsystem = riskResult.getPrimarySubsystem();
        boolean hasUnresolvedAlert = alertRepository.existsByVehicleIdAndSubsystemAndResolvedAtIsNull(vehicle.getId(), subsystem);

        if (!hasUnresolvedAlert) {
            Severity severity = Severity.LOW;
            double score = riskResult.getOverallScore();
            if (score >= 0.85) {
                severity = Severity.CRITICAL;
            } else if (score >= 0.75) {
                severity = Severity.HIGH;
            } else if (score >= 0.60) {
                severity = Severity.MEDIUM;
            }

            Alert alert = Alert.builder()
                    .vehicle(vehicle)
                    .subsystem(subsystem)
                    .severity(severity)
                    .riskScore(score)
                    .message(riskResult.getExplanationMessage())
                    .build();

            Alert savedAlert = alertRepository.save(alert);
            log.info("Created new Alert [ID: {}] for VIN: {}, Subsystem: {}, Severity: {}",
                    savedAlert.getId(), vehicle.getVin(), subsystem, severity);

            // Publish alert to Kafka 'alerts' topic
            producerService.sendAlert(savedAlert);
        } else {
            log.info("Unresolved alert already exists for VIN: {}, Subsystem: {}. Skipping duplicate alert creation.",
                    vehicle.getVin(), subsystem);
        }
    }

    private RollingStats readRollingStatsFromRedis(String key) {
        try {
            String json = redisTemplate.opsForValue().get(key);
            if (json != null && !json.isBlank()) {
                return objectMapper.readValue(json, RollingStats.class);
            }
        } catch (Exception e) {
            log.warn("Could not read rolling stats from Redis key {}: {}", key, e.getMessage());
        }
        return new RollingStats();
    }

    private void writeToRedis(String key, Object value, Duration ttl) {
        try {
            String json = objectMapper.writeValueAsString(value);
            if (ttl != null) {
                redisTemplate.opsForValue().set(key, json, ttl);
            } else {
                redisTemplate.opsForValue().set(key, json);
            }
        } catch (Exception e) {
            log.error("Failed to write key {} to Redis: {}", key, e.getMessage());
        }
    }
}
