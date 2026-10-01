package com.fleetguard.fleet_service.scorer;

import com.fleetguard.fleet_service.dto.RiskScoreResult;
import com.fleetguard.fleet_service.dto.RollingStats;
import com.fleetguard.fleet_service.dto.TelemetryEvent;
import com.fleetguard.fleet_service.entity.EventType;
import com.fleetguard.fleet_service.entity.Subsystem;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class ThresholdRiskScorer implements RiskScorer {

    @Override
    public RiskScoreResult score(RollingStats stats, TelemetryEvent event) {
        double engineRisk = 0.0;
        double batteryRisk = 0.0;
        double brakesRisk = 0.0;
        List<String> details = new ArrayList<>();

        // 1. Engine Risk Evaluation (Temp creeping up)
        if (stats.getEngineTempEwma() != null) {
            double temp = stats.getEngineTempEwma();
            if (temp > 105.0) {
                engineRisk = 0.95;
                details.add(String.format("Engine EWMA temp critical (%.1f°C > 105°C)", temp));
            } else if (temp > 100.0) {
                engineRisk = 0.75;
                details.add(String.format("Engine EWMA temp high (%.1f°C > 100°C)", temp));
            } else if (temp > 92.0) {
                engineRisk = 0.40;
                details.add(String.format("Engine EWMA temp elevated (%.1f°C > 92°C)", temp));
            }
        }

        // 2. Battery Risk Evaluation (Voltage sagging)
        if (stats.getBatteryVEwma() != null) {
            double volt = stats.getBatteryVEwma();
            if (volt < 11.0) {
                batteryRisk = 0.95;
                details.add(String.format("Battery EWMA voltage critical (%.2fV < 11.0V)", volt));
            } else if (volt < 11.5) {
                batteryRisk = 0.75;
                details.add(String.format("Battery EWMA voltage low (%.2fV < 11.5V)", volt));
            } else if (volt < 12.0) {
                batteryRisk = 0.35;
                details.add(String.format("Battery EWMA voltage sagging (%.2fV < 12.0V)", volt));
            }
        }

        // 3. Brakes & Fault Code (DTC) Risk Evaluation
        if (event.evt() == EventType.HARSH_BRAKE) {
            brakesRisk = Math.max(brakesRisk, 0.50);
            details.add("Harsh braking event detected");
        }

        if (stats.getRecentDtcCount() > 2) {
            double dtcContribution = 0.30;
            engineRisk = Math.min(1.0, engineRisk + dtcContribution);
            batteryRisk = Math.min(1.0, batteryRisk + dtcContribution);
            brakesRisk = Math.min(1.0, brakesRisk + dtcContribution);
            details.add(String.format("Multiple DTC codes present (%d in last 10 events)", stats.getRecentDtcCount()));
        }

        // Determine dominant risk and primary subsystem
        Subsystem primarySubsystem = Subsystem.ENGINE;
        double maxSubsystemScore = engineRisk;

        if (batteryRisk > maxSubsystemScore) {
            maxSubsystemScore = batteryRisk;
            primarySubsystem = Subsystem.BATTERY;
        }

        if (brakesRisk > maxSubsystemScore) {
            maxSubsystemScore = brakesRisk;
            primarySubsystem = Subsystem.BRAKES;
        }

        if (maxSubsystemScore == 0.0) {
            primarySubsystem = Subsystem.UNKNOWN;
        }

        // Weighted overall risk formula: Max subsystem risk + 20% of secondary risks,
        // capped at 1.0
        double totalSecondary = (engineRisk + batteryRisk + brakesRisk) - maxSubsystemScore;
        double overallScore = Math.min(1.0, maxSubsystemScore + (0.2 * totalSecondary));

        // Format message
        String message = details.isEmpty()
                ? "Vehicle parameters normal"
                : String.join("; ", details);

        return RiskScoreResult.builder()
                .overallScore(overallScore)
                .engineRisk(engineRisk)
                .batteryRisk(batteryRisk)
                .brakesRisk(brakesRisk)
                .primarySubsystem(primarySubsystem)
                .explanationMessage(message)
                .build();
    }
}
