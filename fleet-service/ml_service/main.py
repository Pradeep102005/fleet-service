import os
import math
import random
import numpy as np
import pandas as pd
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest

app = FastAPI(title="FleetPulse ML & Predictive Maintenance Service", version="1.0.0")

# --- Request / Response Schemas ---

class TelemetryFeaturesInput(BaseModel):
    vin: str
    engineTempC: float
    engineTempEwma: float
    batteryV: float
    batteryVEwma: float
    coolantTempC: Optional[float] = None
    oilPressureBar: Optional[float] = None
    engineRpm: Optional[float] = None
    brakeTempC: Optional[float] = None
    speedKmh: Optional[float] = 60.0
    socPct: Optional[float] = 80.0
    odoKm: Optional[float] = 25000.0
    recentDtcCount: Optional[int] = 0
    dtcList: Optional[List[str]] = Field(default_factory=list)
    eventType: Optional[str] = "NORMAL"

class XaiContribution(BaseModel):
    factor: str
    contributionPct: float

class SubsystemRisk(BaseModel):
    engine: float
    battery: float
    brakes: float
    cooling: float

class RemainingUsefulLife(BaseModel):
    subsystem: str
    rulDistanceKm: Optional[str] = None
    rulDaysWindow: Optional[str] = None
    confidencePct: float

class PredictionResponse(BaseModel):
    vin: str
    overallRiskScore: float
    status: str  # HEALTHY, WARNING, CRITICAL
    anomalyScore: float  # 0.0 to 1.0 (1.0 high anomaly)
    primarySubsystem: str
    subsystemRisks: SubsystemRisk
    rul: RemainingUsefulLife
    xaiContributions: List[XaiContribution]
    explanationMessage: str

# --- Machine Learning Engine Initialization ---

iso_forest: Optional[IsolationForest] = None

def init_models():
    global iso_forest
    # Generate 1000 normal baseline feature vectors to fit Isolation Forest
    np.random.seed(42)
    normal_temps = np.random.normal(90.0, 3.0, 1000)
    normal_volts = np.random.normal(12.5, 0.3, 1000)
    normal_coolants = np.random.normal(92.0, 2.5, 1000)
    normal_oils = np.random.normal(3.5, 0.3, 1000)
    normal_dtcs = np.random.poisson(0.1, 1000)

    X_train = np.column_stack([normal_temps, normal_volts, normal_coolants, normal_oils, normal_dtcs])
    iso_forest = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    iso_forest.fit(X_train)
    print("IsolationForest baseline anomaly detector initialized successfully.")

@app.on_event("startup")
def startup_event():
    init_models()

@app.get("/health")
def health_check():
    return {"status": "UP", "service": "FleetPulse ML Engine"}

@app.post("/predict", response_model=PredictionResponse)
def predict_vehicle_risk(data: TelemetryFeaturesInput):
    coolant = data.coolantTempC if data.coolantTempC is not None else data.engineTempEwma
    oil = data.oilPressureBar if data.oilPressureBar is not None else 3.5
    brake_temp = data.brakeTempC if data.brakeTempC is not None else 75.0
    dtc_cnt = data.recentDtcCount or 0
    dtc_list = data.dtcList or []

    # --- Layer 1: Rule Engine (Immediate Critical Checks) ---
    rule_critical = False
    rule_reasons = []

    if oil < 1.5:
        rule_critical = True
        rule_reasons.append(f"Critically low oil pressure ({oil:.1f} bar < 1.5 bar)")
    if coolant > 112.0:
        rule_critical = True
        rule_reasons.append(f"Severe coolant overheating ({coolant:.1f}°C > 112°C)")
    if data.batteryVEwma < 10.5:
        rule_critical = True
        rule_reasons.append(f"Critical battery voltage drop ({data.batteryVEwma:.2f}V < 10.5V)")

    # --- Layer 2: Anomaly Detection (Isolation Forest Score) ---
    feature_vec = np.array([[data.engineTempEwma, data.batteryVEwma, coolant, oil, dtc_cnt]])
    # decision_function gives negative for anomalies, positive for normal
    if iso_forest:
        raw_score = iso_forest.decision_function(feature_vec)[0]
        # Map raw decision score (range ~ -0.3 to 0.3) to 0.0 - 1.0 anomaly index
        anomaly_score = float(np.clip(0.5 - (raw_score * 2.5), 0.0, 1.0))
    else:
        anomaly_score = 0.1

    # --- Layer 3: Multi-Subsystem Failure Probabilities ---
    # Engine Risk calculation
    engine_risk = 0.0
    if data.engineTempEwma > 105.0:
        engine_risk = 0.95
    elif data.engineTempEwma > 100.0:
        engine_risk = 0.75
    elif data.engineTempEwma > 93.0:
        engine_risk = 0.40
    if oil < 2.5:
        engine_risk = min(1.0, engine_risk + 0.35)

    # Cooling Risk calculation
    cooling_risk = 0.0
    if coolant > 108.0:
        cooling_risk = 0.96
    elif coolant > 100.0:
        cooling_risk = 0.78
    elif coolant > 95.0:
        cooling_risk = 0.35

    # Battery Risk calculation
    battery_risk = 0.0
    if data.batteryVEwma < 11.0:
        battery_risk = 0.95
    elif data.batteryVEwma < 11.6:
        battery_risk = 0.70
    elif data.batteryVEwma < 12.0:
        battery_risk = 0.30

    # Brakes Risk calculation
    brakes_risk = 0.0
    if data.eventType == "HARSH_BRAKE":
        brakes_risk += 0.45
    if brake_temp > 120.0:
        brakes_risk += 0.40

    # DTC influence across subsystems
    if "P0217" in dtc_list or "P0128" in dtc_list:
        cooling_risk = min(1.0, cooling_risk + 0.30)
    if "P0301" in dtc_list or "P0300" in dtc_list:
        engine_risk = min(1.0, engine_risk + 0.35)
    if "P0562" in dtc_list:
        battery_risk = min(1.0, battery_risk + 0.35)

    # Determine dominant subsystem
    subsystems = {
        "COOLING": cooling_risk,
        "ENGINE": engine_risk,
        "BATTERY": battery_risk,
        "BRAKES": brakes_risk
    }
    primary_subsystem = max(subsystems, key=subsystems.get)
    primary_score = subsystems[primary_subsystem]

    # Combine with Anomaly score & Rule engine
    max_subsystem_risk = max(primary_score, anomaly_score * 0.8)
    if rule_critical:
        overall_risk = max(0.96, max_subsystem_risk)
    else:
        overall_risk = min(1.0, max_subsystem_risk)

    # Status classification
    if overall_risk >= 0.75:
        status = "CRITICAL"
    elif overall_risk >= 0.50:
        status = "WARNING"
    else:
        status = "HEALTHY"

    # --- Layer 4: Remaining Useful Life (RUL) ---
    if primary_subsystem == "COOLING":
        if cooling_risk > 0.7:
            rul_days = "1 - 3 days"
            confidence = 94.0
        elif cooling_risk > 0.4:
            rul_days = "4 - 7 days"
            confidence = 88.0
        else:
            rul_days = "> 30 days"
            confidence = 92.0
        rul = RemainingUsefulLife(
            subsystem="Cooling System",
            rulDaysWindow=rul_days,
            confidencePct=confidence
        )
    elif primary_subsystem == "BRAKES":
        if brakes_risk > 0.7:
            rul_dist = "400 - 800 km"
            confidence = 89.0
        elif brakes_risk > 0.4:
            rul_dist = "1,200 - 1,600 km"
            confidence = 87.0
        else:
            rul_dist = "> 5,000 km"
            confidence = 95.0
        rul = RemainingUsefulLife(
            subsystem="Brake System",
            rulDistanceKm=rul_dist,
            confidencePct=confidence
        )
    elif primary_subsystem == "BATTERY":
        if battery_risk > 0.7:
            rul_days = "< 24 hours"
            confidence = 92.0
        elif battery_risk > 0.4:
            rul_days = "3 - 5 days"
            confidence = 85.0
        else:
            rul_days = "> 60 days"
            confidence = 90.0
        rul = RemainingUsefulLife(
            subsystem="Battery System",
            rulDaysWindow=rul_days,
            confidencePct=confidence
        )
    else:  # ENGINE
        if engine_risk > 0.7:
            rul_days = "1 - 2 days"
            confidence = 91.0
        elif engine_risk > 0.4:
            rul_days = "5 - 10 days"
            confidence = 86.0
        else:
            rul_days = "> 45 days"
            confidence = 93.0
        rul = RemainingUsefulLife(
            subsystem="Engine System",
            rulDaysWindow=rul_days,
            confidencePct=confidence
        )

    # --- Layer 5: Explainable AI (XAI / SHAP-style Risk Contributions) ---
    xai_items = []
    total_points = 0.0

    c_temp_diff = max(0, coolant - 90.0)
    if c_temp_diff > 0:
        pts = c_temp_diff * 2.0
        xai_items.append(("Coolant temp escalation", pts))
        total_points += pts

    if data.engineTempEwma > 92.0:
        pts = (data.engineTempEwma - 92.0) * 1.8
        xai_items.append(("Engine temp trend", pts))
        total_points += pts

    if dtc_list:
        pts = len(dtc_list) * 20.0
        xai_items.append((f"Diagnostic code ({', '.join(dtc_list)})", pts))
        total_points += pts

    if oil < 3.0:
        pts = (3.0 - oil) * 25.0
        xai_items.append(("Low oil pressure trend", pts))
        total_points += pts

    if data.batteryVEwma < 12.2:
        pts = (12.2 - data.batteryVEwma) * 30.0
        xai_items.append(("Battery voltage sagging", pts))
        total_points += pts

    if data.eventType == "HARSH_BRAKE":
        pts = 20.0
        xai_items.append(("Harsh braking pattern", pts))
        total_points += pts

    if anomaly_score > 0.4:
        pts = anomaly_score * 25.0
        xai_items.append(("Statistical baseline anomaly", pts))
        total_points += pts

    # Normalize contributions to sum up to (overall_risk * 100)%
    target_sum = overall_risk * 100.0
    xai_contributions = []
    if total_points > 0:
        for factor, pts in xai_items:
            pct = round((pts / total_points) * target_sum, 1)
            if pct > 0:
                xai_contributions.append(XaiContribution(factor=factor, contributionPct=pct))
    else:
        xai_contributions.append(XaiContribution(factor="Normal nominal operations", contributionPct=round(target_sum, 1)))

    # Sort descending by contribution
    xai_contributions.sort(key=lambda x: x.contributionPct, reverse=True)

    # Explanation message
    top_factors = [f"{x.factor} (+{x.contributionPct}%)" for x in xai_contributions[:2]]
    msg = "; ".join(rule_reasons) if rule_reasons else f"Primary factors: {', '.join(top_factors)}"

    return PredictionResponse(
        vin=data.vin,
        overallRiskScore=round(overall_risk, 3),
        status=status,
        anomalyScore=round(anomaly_score, 3),
        primarySubsystem=primary_subsystem,
        subsystemRisks=SubsystemRisk(
            engine=round(engine_risk, 3),
            battery=round(battery_risk, 3),
            brakes=round(brakes_risk, 3),
            cooling=round(cooling_risk, 3)
        ),
        rul=rul,
        xaiContributions=xai_contributions,
        explanationMessage=msg
    )

# --- LangGraph AI Fleet Copilot Engine ---

class CopilotQueryRequest(BaseModel):
    query: str
    vin: Optional[str] = None
    contextFilter: Optional[str] = None  # e.g., "ALL", "CRITICAL", "MAINTENANCE"

class CopilotToolCall(BaseModel):
    toolName: str
    args: Dict[str, Any]
    result: str

class CopilotResponse(BaseModel):
    query: str
    replyText: str
    suggestedActions: List[str]
    executedTools: List[CopilotToolCall]
    actionableVehicles: Optional[List[Dict[str, Any]]] = None

# Mock DB store for Copilot tool execution
ACTIVE_WORK_ORDERS = []

def tool_get_fleet_health_summary():
    return {
        "totalVehicles": 1000,
        "criticalCount": 14,
        "warningCount": 42,
        "healthyCount": 944,
        "avgRulDays": 28.4,
        "topActiveDtc": ["P0301 (Cylinder 1 Misfire)", "P0217 (Engine Overheat)", "P0562 (Low System Voltage)"]
    }

def tool_recommend_spare_parts(subsystem: str):
    parts_map = {
        "ENGINE": [{"partNo": "ENG-FLT-904", "name": "Heavy Duty Oil Filter", "stock": 42, "cost": "$45.00"}, {"partNo": "ENG-SPK-102", "name": "Iridium Spark Plugs Set", "stock": 18, "cost": "$120.00"}],
        "COOLING": [{"partNo": "CLR-PMP-501", "name": "Electric Coolant Pump", "stock": 8, "cost": "$310.00"}, {"partNo": "CLR-THM-882", "name": "Thermostat Assembly", "stock": 15, "cost": "$65.00"}],
        "BATTERY": [{"partNo": "BAT-EV-700", "name": "12V AGM Auxiliary Battery", "stock": 12, "cost": "$240.00"}, {"partNo": "BAT-BMS-300", "name": "BMS Sensing Wiring Harness", "stock": 5, "cost": "$180.00"}],
        "BRAKES": [{"partNo": "BRK-PAD-004", "name": "Ceramic Brake Pad Set (Front)", "stock": 25, "cost": "$95.00"}, {"partNo": "BRK-RTR-110", "name": "Vented Brake Rotor", "stock": 14, "cost": "$160.00"}]
    }
    return parts_map.get(subsystem.upper(), [{"partNo": "GEN-KIT-001", "name": "Standard Fleet Inspection Kit", "stock": 50, "cost": "$50.00"}])

def tool_schedule_work_order(vin: str, issue: str, priority: str):
    wo_id = f"WO-{random.randint(1000, 9999)}"
    order = {
        "id": wo_id,
        "vin": vin,
        "issue": issue,
        "priority": priority,
        "status": "SCHEDULED",
        "technician": "Unassigned (Auto-Queue)",
        "scheduledDate": "2026-10-02"
    }
    ACTIVE_WORK_ORDERS.append(order)
    return order

@app.post("/copilot/query", response_model=CopilotResponse)
def execute_copilot_graph(req: CopilotQueryRequest):
    q = req.query.lower()
    executed_tools = []
    suggested_actions = []
    actionable_vehicles = []

    if "dtc" in q or "fault" in q or "code" in q:
        tool_res = tool_get_fleet_health_summary()
        executed_tools.append(CopilotToolCall(
            toolName="get_fleet_health_summary",
            args={},
            result=str(tool_res)
        ))
        reply = (
            "### 🔍 DTC Diagnostic Summary\n\n"
            "Analyzed real-time telemetry stream across 1,000 active vehicles:\n"
            "- **P0301**: Cylinder 1 Misfire Detected (8 vehicles)\n"
            "- **P0217**: Engine Coolant Over-temperature (5 vehicles)\n"
            "- **P0562**: System Voltage Low / Alternator Degradation (6 vehicles)\n\n"
            "**AI Recommendation:** Prioritize vehicles throwing `P0217` immediately as coolant failure leads to engine seizure within 48 hours."
        )
        suggested_actions = [
            "Auto-schedule maintenance for high-risk vehicles",
            "Check spare parts stock for Coolant Pumps",
            "Show critical vehicle list"
        ]
        actionable_vehicles = [
            {"vin": "VIN-1002", "riskScore": 0.94, "primarySubsystem": "COOLING", "issue": "P0217 Coolant Overheat"},
            {"vin": "VIN-1045", "riskScore": 0.89, "primarySubsystem": "ENGINE", "issue": "P0301 Cylinder Misfire"},
            {"vin": "VIN-1088", "riskScore": 0.85, "primarySubsystem": "BATTERY", "issue": "P0562 Voltage Sag"}
        ]

    elif "schedule" in q or "maintain" in q or "work order" in q or "fix" in q:
        target_vin = req.vin or "VIN-1002"
        wo = tool_schedule_work_order(target_vin, "Predictive Engine Overheat Warning", "HIGH")
        executed_tools.append(CopilotToolCall(
            toolName="schedule_work_order",
            args={"vin": target_vin, "issue": "Engine Overheat", "priority": "HIGH"},
            result=f"Generated Work Order #{wo['id']}"
        ))
        spares = tool_recommend_spare_parts("COOLING")
        executed_tools.append(CopilotToolCall(
            toolName="recommend_spare_parts",
            args={"subsystem": "COOLING"},
            result=f"Found {len(spares)} matching items in inventory"
        ))
        reply = (
            f"### 🛠️ Maintenance Work Order Created\n\n"
            f"Work Order **#{wo['id']}** has been successfully dispatched for **{target_vin}**.\n\n"
            f"**Assigned Priority:** `HIGH`  \n"
            f"**Scheduled Date:** `{wo['scheduledDate']}`  \n"
            f"**Required Parts Reserved:**\n"
            f"- `{spares[0]['partNo']}`: {spares[0]['name']} (In Stock: {spares[0]['stock']})\n"
            f"- `{spares[1]['partNo']}`: {spares[1]['name']} (In Stock: {spares[1]['stock']})\n\n"
            f"The vehicle driver has been notified to route to the nearest service depot."
        )
        suggested_actions = [
            "Open Maintenance Planner UI",
            "Assign Senior Master Technician",
            "Export Work Order PDF"
        ]

    elif "part" in q or "stock" in q or "inventory" in q:
        spares_cooling = tool_recommend_spare_parts("COOLING")
        spares_battery = tool_recommend_spare_parts("BATTERY")
        executed_tools.append(CopilotToolCall(
            toolName="recommend_spare_parts",
            args={"subsystem": "COOLING/BATTERY"},
            result="Fetched inventory items"
        ))
        reply = (
            "### 📦 Spare Parts Inventory Status\n\n"
            "**Cooling Subsystem:**\n"
            f"- `{spares_cooling[0]['name']}` ({spares_cooling[0]['partNo']}): {spares_cooling[0]['stock']} units available ({spares_cooling[0]['cost']}/unit)\n"
            f"- `{spares_cooling[1]['name']}` ({spares_cooling[1]['partNo']}): {spares_cooling[1]['stock']} units available ({spares_cooling[1]['cost']}/unit)\n\n"
            "**Battery & Electrical Subsystem:**\n"
            f"- `{spares_battery[0]['name']}` ({spares_battery[0]['partNo']}): {spares_battery[0]['stock']} units available ({spares_battery[0]['cost']}/unit)\n"
            f"- `{spares_battery[1]['name']}` ({spares_battery[1]['partNo']}): {spares_battery[1]['stock']} units available ({spares_battery[1]['cost']}/unit)\n\n"
            "Stock levels are optimal to cover predicted failure rates for the next 14 days."
        )
        suggested_actions = [
            "Reorder Low Stock Items",
            "Auto-schedule maintenance for high-risk vehicles"
        ]

    else:
        # Default Fleet Overview query
        summary = tool_get_fleet_health_summary()
        executed_tools.append(CopilotToolCall(
            toolName="get_fleet_health_summary",
            args={},
            result=str(summary)
        ))
        reply = (
            "### 📊 Fleet Pulse Intelligence Report\n\n"
            f"Monitoring **{summary['totalVehicles']}** active fleet assets in real-time:\n"
            f"- 🟢 **Healthy Vehicles:** {summary['healthyCount']} (94.4% operational)\n"
            f"- 🟡 **Warning Status:** {summary['warningCount']} vehicles (monitoring temperature/voltage drift)\n"
            f"- 🔴 **Critical Risk:** {summary['criticalCount']} vehicles (immediate maintenance required)\n\n"
            f"**Average Fleet RUL:** `{summary['avgRulDays']} days`  \n"
            "IsolationForest ML anomaly detection models predict **3 vehicles** are at risk of thermal run-away within 48 hours."
        )
        suggested_actions = [
            "What DTC diagnostic codes are active?",
            "Auto-schedule maintenance for high-risk vehicles",
            "Check spare parts stock level"
        ]
        actionable_vehicles = [
            {"vin": "VIN-1002", "riskScore": 0.94, "primarySubsystem": "COOLING", "issue": "Coolant Overheat > 112°C"},
            {"vin": "VIN-1045", "riskScore": 0.89, "primarySubsystem": "ENGINE", "issue": "Low Oil Pressure 1.4 bar"},
            {"vin": "VIN-1088", "riskScore": 0.85, "primarySubsystem": "BATTERY", "issue": "Battery Voltage 10.4V"}
        ]

    return CopilotResponse(
        query=req.query,
        replyText=reply,
        suggestedActions=suggested_actions,
        executedTools=executed_tools,
        actionableVehicles=actionable_vehicles
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

