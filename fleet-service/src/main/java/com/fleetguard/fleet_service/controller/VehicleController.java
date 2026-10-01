package com.fleetguard.fleet_service.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleetguard.fleet_service.dto.RollingStats;
import com.fleetguard.fleet_service.dto.VehicleHealth;
import com.fleetguard.fleet_service.dto.VehicleResponseDto;
import com.fleetguard.fleet_service.dto.BulkVehicleHealthDto;
import com.fleetguard.fleet_service.entity.Subsystem;
import com.fleetguard.fleet_service.entity.Vehicle;
import com.fleetguard.fleet_service.entity.mongo.TelemetryDocument;
import com.fleetguard.fleet_service.repository.VehicleRepository;
import com.fleetguard.fleet_service.repository.mongo.TelemetryMongoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/vehicles")
@RequiredArgsConstructor
@Slf4j
public class VehicleController {

    private final VehicleRepository vehicleRepository;
    private final TelemetryMongoRepository telemetryMongoRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<Page<VehicleResponseDto>> getVehicles(
            @RequestParam(name = "fleetId", required = false) UUID fleetId,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("registeredAt").descending());
        Page<Vehicle> vehicles;
        if (fleetId != null) {
            vehicles = vehicleRepository.findByFleetId(fleetId, pageable);
        } else {
            vehicles = vehicleRepository.findAll(pageable);
        }
        return ResponseEntity.ok(vehicles.map(VehicleResponseDto::fromEntity));
    }

    @GetMapping("/{vin}/health")
    public ResponseEntity<VehicleHealth> getVehicleHealth(@PathVariable("vin") String vin) {
        String healthKey = "vehicle:health:" + vin;
        try {
            String json = redisTemplate.opsForValue().get(healthKey);
            if (json != null && !json.isBlank()) {
                VehicleHealth health = objectMapper.readValue(json, VehicleHealth.class);
                return ResponseEntity.ok(health);
            }
        } catch (Exception e) {
            log.warn("Error reading health blob from Redis for VIN {}: {}", vin, e.getMessage());
        }

        // Return sensible default if not present in Redis
        VehicleHealth defaultHealth = VehicleHealth.builder()
                .vin(vin)
                .overallRiskScore(0.0)
                .status("HEALTHY")
                .engineRisk(0.0)
                .batteryRisk(0.0)
                .brakesRisk(0.0)
                .primarySubsystem(Subsystem.UNKNOWN)
                .rollingStats(new RollingStats())
                .updatedAt(Instant.now())
                .build();

        return ResponseEntity.ok(defaultHealth);
    }

    @GetMapping("/health/bulk")
    public ResponseEntity<List<BulkVehicleHealthDto>> getBulkVehicleHealth(
            @RequestParam(name = "fleetId", required = false) UUID fleetId,
            @RequestParam(name = "limit", defaultValue = "500") int limit
    ) {
        // Find keys using SCAN-like pattern (keys() is okay for hackathon demo scale, but SCAN is better for prod)
        // Here we just use keys() to grab up to limit.
        Set<String> keys = redisTemplate.keys("vehicle:health:*");
        if (keys == null || keys.isEmpty()) {
            return ResponseEntity.ok(new ArrayList<>());
        }
        
        List<String> keyList = keys.stream().limit(limit).collect(Collectors.toList());
        List<String> jsonValues = redisTemplate.opsForValue().multiGet(keyList);
        
        List<BulkVehicleHealthDto> result = new ArrayList<>();
        if (jsonValues != null) {
            for (String json : jsonValues) {
                if (json != null && !json.isBlank()) {
                    try {
                        VehicleHealth health = objectMapper.readValue(json, VehicleHealth.class);
                        result.add(BulkVehicleHealthDto.builder()
                                .vin(health.getVin())
                                .lat(health.getLat())
                                .lon(health.getLon())
                                .riskScore(health.getOverallRiskScore())
                                .subsystem(health.getPrimarySubsystem())
                                .build());
                    } catch (Exception e) {
                        log.warn("Error parsing health JSON in bulk: {}", e.getMessage());
                    }
                }
            }
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{vin}/telemetry/history")
    public ResponseEntity<List<TelemetryDocument>> getTelemetryHistory(@PathVariable("vin") String vin) {
        List<TelemetryDocument> history = telemetryMongoRepository.findTop50ByVinOrderByTimestampDesc(vin);
        // Reverse so oldest is first (for charts left-to-right)
        java.util.Collections.reverse(history);
        return ResponseEntity.ok(history);
    }
}
