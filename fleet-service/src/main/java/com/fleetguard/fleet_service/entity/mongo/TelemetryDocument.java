package com.fleetguard.fleet_service.entity.mongo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "telemetry_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TelemetryDocument {

    @Id
    private String id;
    private String vin;
    private LocalDateTime timestamp;
    private Double speed;
    private Double latitude;
    private Double longitude;
    private Double batterySoc;
    private Double engineTemperature;
    private Double engineRpm;
    private Double oilPressure;
    private Double brakeTemperature;
    private Double coolantTemperature;
    private Double voltage;
    private List<String> dtc;
    private String event;
    private Double odometer;
    private Long sequence;
}
