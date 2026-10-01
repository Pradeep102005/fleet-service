package com.fleetguard.fleet_service.scorer;

import com.fleetguard.fleet_service.dto.RiskScoreResult;
import com.fleetguard.fleet_service.dto.RollingStats;
import com.fleetguard.fleet_service.dto.TelemetryEvent;
import com.fleetguard.fleet_service.entity.Subsystem;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Component
@Primary
@Slf4j
public class MlRiskScorer implements RiskScorer {

    private static final String ML_PREDICT_URL = "http://localhost:8001/predict";
    private final ThresholdRiskScorer fallbackScorer;
    private final RestTemplate restTemplate;

    public MlRiskScorer(ThresholdRiskScorer fallbackScorer) {
        this.fallbackScorer = fallbackScorer;
        
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(800); // 800ms fast connect timeout
        factory.setReadTimeout(1200);    // 1.2s read timeout
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    public RiskScoreResult score(RollingStats stats, TelemetryEvent event) {
        try {
            Map<String, Object> req = new HashMap<>();
            req.put("vin", event.vin());
            req.put("engineTempC", event.engineTempC());
            req.put("engineTempEwma", stats.getEngineTempEwma() != null ? stats.getEngineTempEwma() : event.engineTempC());
            req.put("batteryV", event.batteryV());
            req.put("batteryVEwma", stats.getBatteryVEwma() != null ? stats.getBatteryVEwma() : event.batteryV());
            req.put("coolantTempC", event.coolantTempC());
            req.put("oilPressureBar", event.oilPressureBar());
            req.put("engineRpm", event.engineRpm());
            req.put("brakeTempC", event.brakeTempC());
            req.put("speedKmh", event.speedKmh());
            req.put("socPct", event.socPct());
            req.put("odoKm", event.odoKm());
            req.put("recentDtcCount", stats.getRecentDtcCount());
            req.put("dtcList", event.dtc());
            req.put("eventType", event.evt() != null ? event.evt().name() : "NORMAL");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(req, headers);

            Map<String, Object> resp = restTemplate.postForObject(ML_PREDICT_URL, entity, Map.class);

            if (resp != null) {
                double overall = parseDouble(resp.get("overallRiskScore"));
                double anomalyScore = parseDouble(resp.get("anomalyScore"));
                String primaryStr = (String) resp.get("primarySubsystem");
                String explanation = (String) resp.get("explanationMessage");

                Map<String, Object> subRisks = (Map<String, Object>) resp.get("subsystemRisks");
                double engine = subRisks != null ? parseDouble(subRisks.get("engine")) : 0.0;
                double battery = subRisks != null ? parseDouble(subRisks.get("battery")) : 0.0;
                double brakes = subRisks != null ? parseDouble(subRisks.get("brakes")) : 0.0;
                double cooling = subRisks != null ? parseDouble(subRisks.get("cooling")) : 0.0;

                Subsystem primarySub = Subsystem.UNKNOWN;
                if ("COOLING".equalsIgnoreCase(primaryStr)) primarySub = Subsystem.COOLING;
                else if ("ENGINE".equalsIgnoreCase(primaryStr)) primarySub = Subsystem.ENGINE;
                else if ("BATTERY".equalsIgnoreCase(primaryStr)) primarySub = Subsystem.BATTERY;
                else if ("BRAKES".equalsIgnoreCase(primaryStr)) primarySub = Subsystem.BRAKES;

                return RiskScoreResult.builder()
                        .overallScore(overall)
                        .engineRisk(engine)
                        .batteryRisk(battery)
                        .brakesRisk(brakes)
                        .coolingRisk(cooling)
                        .anomalyScore(anomalyScore)
                        .primarySubsystem(primarySub)
                        .explanationMessage(explanation)
                        .failureProbabilities(subRisks)
                        .rulInfo(resp.get("rul"))
                        .xaiContributions(resp.get("xaiContributions"))
                        .build();
            }
        } catch (Exception e) {
            log.warn("ML Service unavailable ({}), falling back to ThresholdRiskScorer.", e.getMessage());
        }

        // Fallback to ThresholdRiskScorer
        return fallbackScorer.score(stats, event);
    }

    private double parseDouble(Object obj) {
        if (obj instanceof Number num) {
            return num.doubleValue();
        }
        return 0.0;
    }
}
