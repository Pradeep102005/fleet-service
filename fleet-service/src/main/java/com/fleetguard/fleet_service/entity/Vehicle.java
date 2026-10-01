package com.fleetguard.fleet_service.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "vehicles", indexes = {
    @Index(name = "idx_vehicle_vin", columnList = "vin", unique = true)
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Vehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 17)
    private String vin;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fleet_id")
    private Fleet fleet;

    private String make;

    private String model;

    private Integer year;

    @Column(name = "mileage_km")
    private Double mileageKm;

    @CreationTimestamp
    @Column(name = "registered_at", nullable = false, updatable = false)
    private LocalDateTime registeredAt;
}
