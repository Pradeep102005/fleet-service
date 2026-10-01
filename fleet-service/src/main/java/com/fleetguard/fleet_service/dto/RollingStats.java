package com.fleetguard.fleet_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RollingStats {

    private Double lastEngineTemp;
    private Double engineTempEwma;
    private Double lastBatteryV;
    private Double batteryVEwma;
    private Double lat;
    private Double lon;
    private Double lastSpeed;
    private Double lastSocPct;
    private Double lastOdoKm;

    @Builder.Default
    private List<Integer> recentDtcCounts = new ArrayList<>();

    private int recentDtcCount;

    public void addDtcCountWindow(int dtcCountInCurrentEvent) {
        if (recentDtcCounts == null) {
            recentDtcCounts = new ArrayList<>();
        }
        recentDtcCounts.add(dtcCountInCurrentEvent);
        if (recentDtcCounts.size() > 10) {
            recentDtcCounts.remove(0);
        }
        recentDtcCount = recentDtcCounts.stream().mapToInt(Integer::intValue).sum();
    }
}
