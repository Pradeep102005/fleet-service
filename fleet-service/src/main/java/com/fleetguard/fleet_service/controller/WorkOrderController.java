package com.fleetguard.fleet_service.controller;

import com.fleetguard.fleet_service.entity.WorkOrder;
import com.fleetguard.fleet_service.repository.WorkOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/work-orders")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class WorkOrderController {

    private final WorkOrderRepository workOrderRepository;

    @GetMapping
    public ResponseEntity<List<WorkOrder>> getAllWorkOrders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String vin) {
        if (vin != null && !vin.isBlank()) {
            return ResponseEntity.ok(workOrderRepository.findByVin(vin));
        }
        if (status != null && !status.isBlank()) {
            return ResponseEntity.ok(workOrderRepository.findByStatus(status));
        }
        return ResponseEntity.ok(workOrderRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<WorkOrder> createWorkOrder(@RequestBody WorkOrder workOrder) {
        if (workOrder.getScheduledDate() == null) {
            workOrder.setScheduledDate(LocalDateTime.now().plusDays(1));
        }
        WorkOrder saved = workOrderRepository.save(workOrder);
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<WorkOrder> updateStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body) {
        return workOrderRepository.findById(id)
                .map(order -> {
                    if (body.containsKey("status")) {
                        order.setStatus(body.get("status"));
                    }
                    if (body.containsKey("technician")) {
                        order.setTechnician(body.get("technician"));
                    }
                    return ResponseEntity.ok(workOrderRepository.save(order));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWorkOrder(@PathVariable UUID id) {
        workOrderRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
