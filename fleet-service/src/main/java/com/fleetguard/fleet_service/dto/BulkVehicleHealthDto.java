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
public class BulkVehicleHealthDto {
    private String vin;
    private Double lat;
    private Double lon;
    private double riskScore;
    private Subsystem subsystem;
}
