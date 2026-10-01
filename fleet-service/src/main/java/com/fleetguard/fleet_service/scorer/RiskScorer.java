package com.fleetguard.fleet_service.scorer;

import com.fleetguard.fleet_service.dto.RiskScoreResult;
import com.fleetguard.fleet_service.dto.RollingStats;
import com.fleetguard.fleet_service.dto.TelemetryEvent;

public interface RiskScorer {

    /**
     * Evaluates vehicle health based on rolling statistics and current telemetry event.
     * Returns a RiskScoreResult containing 0.0 - 1.0 risk score and subsystem breakdown.
     */
    RiskScoreResult score(RollingStats stats, TelemetryEvent event);
}
