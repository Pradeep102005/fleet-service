package com.fleetguard.fleet_service.repository;

import com.fleetguard.fleet_service.entity.WorkOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface WorkOrderRepository extends JpaRepository<WorkOrder, UUID> {
    List<WorkOrder> findByVin(String vin);
    List<WorkOrder> findByStatus(String status);
    List<WorkOrder> findByPriority(String priority);
}
