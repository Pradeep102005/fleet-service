package com.fleetguard.fleet_service.repository;

import com.fleetguard.fleet_service.entity.Alert;
import com.fleetguard.fleet_service.entity.Severity;
import com.fleetguard.fleet_service.entity.Subsystem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AlertRepository extends JpaRepository<Alert, UUID> {

    @Query("SELECT a FROM Alert a JOIN FETCH a.vehicle v WHERE (:status IS NULL OR (:status = 'open' AND a.resolvedAt IS NULL) OR (:status = 'closed' AND a.resolvedAt IS NOT NULL)) ORDER BY a.createdAt DESC")
    Page<Alert> findAlertsByStatusWithVehicle(@Param("status") String status, Pageable pageable);

    boolean existsByVehicleIdAndSubsystemAndResolvedAtIsNull(UUID vehicleId, Subsystem subsystem);

    long countByVehicleFleetIdAndResolvedAtIsNullAndSeverity(UUID fleetId, Severity severity);

    long countByVehicleFleetIdAndResolvedAtIsNull(UUID fleetId);

    long countByResolvedAtIsNullAndSeverity(Severity severity);

    long countByResolvedAtIsNull();
}
