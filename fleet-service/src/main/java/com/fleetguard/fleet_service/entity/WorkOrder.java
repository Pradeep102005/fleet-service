package com.fleetguard.fleet_service.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "work_orders")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String vin;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String subsystem; // ENGINE, BATTERY, BRAKES, COOLING

    @Column(nullable = false)
    private String priority; // CRITICAL, HIGH, MEDIUM, LOW

    @Column(nullable = false)
    private String status; // SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED

    private String technician;
    
    private Double estimatedCost;

    private Integer estimatedDowntimeHours;

    private String spareParts;

    private LocalDateTime scheduledDate;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (status == null) {
            status = "SCHEDULED";
        }
    }
}
