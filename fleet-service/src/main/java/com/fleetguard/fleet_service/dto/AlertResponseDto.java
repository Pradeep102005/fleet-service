package com.fleetguard.fleet_service.dto;

import com.fleetguard.fleet_service.entity.Alert;
import com.fleetguard.fleet_service.entity.Severity;
import com.fleetguard.fleet_service.entity.Subsystem;

import java.time.LocalDateTime;
import java.util.UUID;

public record AlertResponseDto(
    UUID id,
    UUID vehicleId,
    String vin,
    String make,
    String model,
    Subsystem subsystem,
    Severity severity,
    Double riskScore,
    String message,
    LocalDateTime createdAt,
    LocalDateTime resolvedAt
) {
    public static AlertResponseDto fromEntity(Alert alert) {
        return new AlertResponseDto(
            alert.getId(),
            alert.getVehicle() != null ? alert.getVehicle().getId() : null,
            alert.getVehicle() != null ? alert.getVehicle().getVin() : null,
            alert.getVehicle() != null ? alert.getVehicle().getMake() : null,
            alert.getVehicle() != null ? alert.getVehicle().getModel() : null,
            alert.getSubsystem(),
            alert.getSeverity(),
            alert.getRiskScore(),
            alert.getMessage(),
            alert.getCreatedAt(),
            alert.getResolvedAt()
        );
    }
}
