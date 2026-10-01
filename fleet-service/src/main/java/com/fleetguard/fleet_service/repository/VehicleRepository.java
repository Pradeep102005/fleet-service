package com.fleetguard.fleet_service.repository;

import com.fleetguard.fleet_service.entity.Vehicle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface VehicleRepository extends JpaRepository<Vehicle, UUID> {
    Optional<Vehicle> findByVin(String vin);
    Page<Vehicle> findByFleetId(UUID fleetId, Pageable pageable);
    long countByFleetId(UUID fleetId);
}
