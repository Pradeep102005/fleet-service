package com.fleetguard.fleet_service.repository;

import com.fleetguard.fleet_service.entity.Fleet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface FleetRepository extends JpaRepository<Fleet, UUID> {
}
