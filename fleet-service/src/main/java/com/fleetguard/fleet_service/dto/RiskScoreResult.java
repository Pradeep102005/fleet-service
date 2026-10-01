package com.fleetguard.fleet_service.dto;

import com.fleetguard.fleet_service.entity.Subsystem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiskScoreResult {
    private double overallScore;
    private double engineRisk;
    private double batteryRisk;
    private double brakesRisk;
    private double coolingRisk;
    private double anomalyScore;
    private Subsystem primarySubsystem;
    private String explanationMessage;
    private Object failureProbabilities;
    private Object rulInfo;
    private Object xaiContributions;
}
