package com.fleetguard.fleet_service.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleetguard.fleet_service.dto.FleetSummaryDto;
import com.fleetguard.fleet_service.dto.VehicleHealth;
import com.fleetguard.fleet_service.entity.Fleet;
import com.fleetguard.fleet_service.entity.Severity;
import com.fleetguard.fleet_service.entity.Vehicle;
import com.fleetguard.fleet_service.repository.AlertRepository;
import com.fleetguard.fleet_service.repository.FleetRepository;
import com.fleetguard.fleet_service.repository.VehicleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/fleets")
@RequiredArgsConstructor
@Slf4j
public class FleetController {

    private final FleetRepository fleetRepository;
    private final VehicleRepository vehicleRepository;
    private final AlertRepository alertRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @GetMapping("/{id}/summary")
    public ResponseEntity<?> getFleetSummary(@PathVariable("id") UUID fleetId) {
        Optional<Fleet> fleetOpt = fleetRepository.findById(fleetId);
        if (fleetOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Fleet fleet = fleetOpt.get();

        long totalVehicles = vehicleRepository.countByFleetId(fleetId);

        Map<Severity, Long> openAlertsBySeverity = new EnumMap<>(Severity.class);
        long openAlertsCount = 0;

        for (Severity severity : Severity.values()) {
            long count = alertRepository.countByVehicleFleetIdAndResolvedAtIsNullAndSeverity(fleetId, severity);
            openAlertsBySeverity.put(severity, count);
            openAlertsCount += count;
        }

        // Calculate average health score from Redis for vehicles in this fleet
        List<Vehicle> fleetVehicles = vehicleRepository.findByFleetId(fleetId, Pageable.unpaged()).getContent();
        double totalHealthScore = 0.0;
        int healthScoresCount = 0;

        for (Vehicle v : fleetVehicles) {
            String healthKey = "vehicle:health:" + v.getVin();
            try {
                String json = redisTemplate.opsForValue().get(healthKey);
                if (json != null && !json.isBlank()) {
                    VehicleHealth health = objectMapper.readValue(json, VehicleHealth.class);
                    totalHealthScore += health.getOverallRiskScore();
                    healthScoresCount++;
                }
            } catch (Exception e) {
                log.debug("No active health score in Redis for VIN {}", v.getVin());
            }
        }

        double averageHealthScore = healthScoresCount > 0 ? (totalHealthScore / healthScoresCount) : 0.0;

        FleetSummaryDto summary = new FleetSummaryDto(
                fleet.getId(),
                fleet.getName(),
                totalVehicles,
                openAlertsCount,
                openAlertsBySeverity,
                averageHealthScore
        );

        return ResponseEntity.ok(summary);
    }
}
