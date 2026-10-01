package com.fleetguard.fleet_service.dto;

import com.fleetguard.fleet_service.entity.Vehicle;

import java.time.LocalDateTime;
import java.util.UUID;

public record VehicleResponseDto(
    UUID id,
    String vin,
    UUID fleetId,
    String fleetName,
    String make,
    String model,
    Integer year,
    Double mileageKm,
    LocalDateTime registeredAt
) {
    public static VehicleResponseDto fromEntity(Vehicle vehicle) {
        return new VehicleResponseDto(
            vehicle.getId(),
            vehicle.getVin(),
            vehicle.getFleet() != null ? vehicle.getFleet().getId() : null,
            vehicle.getFleet() != null ? vehicle.getFleet().getName() : null,
            vehicle.getMake(),
            vehicle.getModel(),
            vehicle.getYear(),
            vehicle.getMileageKm(),
            vehicle.getRegisteredAt()
        );
    }
}
