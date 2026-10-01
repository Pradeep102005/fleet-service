package com.fleetguard.fleet_service.dto;

import com.fleetguard.fleet_service.entity.Subsystem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VehicleHealth {

    private String vin;
    private double overallRiskScore;
    private String status; // HEALTHY, WARNING, CRITICAL
    private double engineRisk;
    private double batteryRisk;
    private double brakesRisk;
    private double coolingRisk;
    private double anomalyScore;
    private Subsystem primarySubsystem;
    private RollingStats rollingStats;
    private Double lat;
    private Double lon;
    private Instant updatedAt;
    private Object failureProbabilities;
    private Object rulInfo;
    private Object xaiContributions;
}
