package com.fleetguard.fleet_service.dto;

import com.fleetguard.fleet_service.entity.Severity;

import java.util.Map;
import java.util.UUID;

public record FleetSummaryDto(
    UUID fleetId,
    String fleetName,
    long totalVehicles,
    long openAlertsCount,
    Map<Severity, Long> openAlertsBySeverity,
    double averageHealthScore
) {}
