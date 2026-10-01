package com.fleetguard.fleet_service.controller;

import com.fleetguard.fleet_service.dto.AlertResponseDto;
import com.fleetguard.fleet_service.entity.Alert;
import com.fleetguard.fleet_service.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/alerts")
@RequiredArgsConstructor
@Slf4j
public class AlertController {

    private final AlertRepository alertRepository;

    @GetMapping
    public ResponseEntity<Page<AlertResponseDto>> getAlerts(
            @RequestParam(name = "status", required = false, defaultValue = "open") String status,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Alert> alerts = alertRepository.findAlertsByStatusWithVehicle(status, pageable);
        Page<AlertResponseDto> response = alerts.map(AlertResponseDto::fromEntity);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<?> resolveAlert(@PathVariable("id") UUID id) {
        return alertRepository.findById(id).map(alert -> {
            if (alert.getResolvedAt() == null) {
                alert.setResolvedAt(LocalDateTime.now());
                Alert updated = alertRepository.save(alert);
                log.info("Resolved alert [ID: {}]", id);
                return ResponseEntity.ok(AlertResponseDto.fromEntity(updated));
            } else {
                return ResponseEntity.ok(AlertResponseDto.fromEntity(alert));
            }
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
