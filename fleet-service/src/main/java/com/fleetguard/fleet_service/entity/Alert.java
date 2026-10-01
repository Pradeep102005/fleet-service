package com.fleetguard.fleet_service.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/*
 * Index Recommendations:
 * 1. Composite Index for quick lookups by vehicle and creation date:
 *    CREATE INDEX idx_alert_vehicle_created ON alerts (vehicle_id, created_at DESC);
 *
 * 2. Partial Index for unresolved/open alerts lookup:
 *    CREATE INDEX idx_alert_open ON alerts (vehicle_id, subsystem) WHERE resolved_at IS NULL;
 */
@Entity
@Table(name = "alerts", indexes = {
    @Index(name = "idx_alert_vehicle_created", columnList = "vehicle_id, created_at DESC")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id", nullable = false)
    private Vehicle vehicle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Subsystem subsystem;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Severity severity;

    @Column(name = "risk_score", nullable = false)
    private Double riskScore;

    @Column(columnDefinition = "TEXT")
    private String message;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;
}
