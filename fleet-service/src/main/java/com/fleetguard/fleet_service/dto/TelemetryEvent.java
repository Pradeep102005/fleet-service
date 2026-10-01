package com.fleetguard.fleet_service.dto;

import com.fleetguard.fleet_service.entity.EventType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;
import java.util.List;

public record TelemetryEvent(
    @NotNull(message = "VIN cannot be null")
    @Pattern(regexp = "^[A-HJ-NPR-Z0-9]{17}$", message = "VIN must be a valid 17-character VIN")
    String vin,

    @NotNull(message = "Timestamp (ts) is required")
    Instant ts,

    @NotNull(message = "Latitude (lat) is required")
    Double lat,

    @NotNull(message = "Longitude (lon) is required")
    Double lon,

    @NotNull(message = "Speed (speedKmh) is required")
    Double speedKmh,

    @NotNull(message = "Engine temperature (engineTempC) is required")
    Double engineTempC,

    @NotNull(message = "Battery voltage (batteryV) is required")
    Double batteryV,

    @NotNull(message = "State of charge (socPct) is required")
    Double socPct,

    @NotNull(message = "Odometer reading (odoKm) is required")
    Double odoKm,

    List<String> dtc,

    Double coolantTempC,
    Double oilPressureBar,
    Double engineRpm,
    Double brakeTempC,

    @NotNull(message = "Event type (evt) is required")
    EventType evt,

    @NotNull(message = "Sequence number (seq) is required")
    Long seq
) {}
