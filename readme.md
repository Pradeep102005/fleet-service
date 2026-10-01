PROJECT: FleetPulse — Predictive Maintenance Backend
CONTEXT FOR YOU (the coding agent):

I am building "FleetPulse", the backend for a Connected Vehicle Intelligence
hackathon project. The core idea: vehicles stream live telemetry (engine
temperature, battery voltage, fault codes, GPS, odometer). We do NOT care
whether a vehicle is currently moving or stopped — a stopped car is normal.
What we care about is SLOW DRIFT over several days in signals that should be
stable (e.g. engine temperature creeping up day over day, battery voltage
sagging, repeated fault codes). We turn that drift into a per-vehicle health
score and an early alert, before the vehicle actually breaks down.

I already generated the Spring Boot project via Spring Initializr with these
dependencies: Spring Web, Spring Data JPA, PostgreSQL Driver, Spring for
Apache Kafka, Spring Data Redis, Validation, Lombok, Spring Boot Actuator.
Build ON TOP of this project — don't regenerate it.

I have 3 days until deadline, so build the MINIMUM VIABLE version first,
end to end, before adding anything extra. Do not add Spring Security, OAuth,
Kubernetes files, or any ML/Python code — those are handled separately or
later. Focus ONLY on what's specified below.

====================================================================
1. WHAT THE SERVICE MUST DO (end to end, in this order)
====================================================================
A vehicle telemetry event arrives -> gets validated -> gets published to a
"clean" Kafka topic (or rejected to a dead-letter topic) -> a consumer
updates a rolling health score for that vehicle in Redis -> if the score
crosses a threshold, an Alert is created in Postgres and published to an
"alerts" Kafka topic -> a REST API exposes vehicles, their current health
score, and open alerts to a frontend.

====================================================================
2. DATA MODEL (PostgreSQL, via Spring Data JPA)
====================================================================
Create JPA entities + repositories for:

- Fleet: id (UUID PK), name, ownerOrg, createdAt
- Vehicle: id (UUID PK), vin (unique, 17 chars), fleet (FK), make, model,
  year, mileageKm, registeredAt
- Alert: id (UUID PK), vehicle (FK), subsystem (enum: ENGINE, BATTERY,
  BRAKES), severity (enum: LOW, MEDIUM, HIGH, CRITICAL), riskScore (double,
  0.0-1.0), message (text), createdAt, resolvedAt (nullable)
- MaintenanceRecord: id (UUID PK), vehicle (FK), type, cost, performedAt,
  notes

Use Lombok (@Data / @Builder / @NoArgsConstructor / @AllArgsConstructor) to
keep entities short. Use Bean Validation annotations (@NotNull, @Pattern for
VIN format, @Min/@Max) on request DTOs, not directly on entities.

Add a composite index recommendation as a comment on Alert for
(vehicle_id, created_at DESC), and a partial-index comment for open alerts
(WHERE resolved_at IS NULL) — write these as a Flyway or plain SQL migration
if you set up Flyway, otherwise as a schema.sql / DDL comment I can run
manually.

====================================================================
3. TELEMETRY EVENT SHAPE (this is what arrives on Kafka)
====================================================================
JSON shape, exactly these fields:
{
  "vin": "string, 17 chars",
  "ts": "ISO-8601 timestamp",
  "lat": double, "lon": double,
  "speedKmh": double,
  "engineTempC": double,
  "batteryV": double,
  "socPct": double,
  "odoKm": double,
  "dtc": ["string", ...],       // list of diagnostic trouble codes, may be empty
  "evt": "NORMAL | HARSH_BRAKE | HARSH_ACCEL | DTC_RAISED | DTC_CLEARED",
  "seq": long                   // per-vehicle monotonically increasing sequence number
}

Create a Java record or DTO class `TelemetryEvent` matching this exactly,
with Jackson annotations if needed for the ts/field naming.

====================================================================
4. KAFKA TOPICS AND FLOW
====================================================================
Topics (create a KafkaAdmin @Bean / NewTopic beans for all of these,
partitions=6, replication=1 for local dev):
  - telemetry.raw    : raw incoming events, keyed by vin
  - telemetry.clean  : validated + normalized events, keyed by vin
  - telemetry.dlq    : events that failed validation, with an added
                        "reason" field explaining why
  - alerts           : Alert objects, keyed by vehicle id

Build these components:

a) INGESTION CONTROLLER (REST):
   POST /api/v1/telemetry/ingest
   Accepts a single TelemetryEvent (or a batch List<TelemetryEvent>) in the
   request body, validates it (VIN format, required fields, ranges), then
   publishes it to "telemetry.raw" via a KafkaTemplate<String, TelemetryEvent>
   keyed by vin. Return 202 Accepted on success, 400 with validation errors
   on bad input.

b) NORMALIZATION CONSUMER (@KafkaListener on telemetry.raw):
   - Validates the event again server-side (defense in depth): VIN checksum
     format, required numeric fields not null/NaN, timestamp parseable.
   - DEDUPLICATION: check Redis for key "dedup:event:{vin}:{seq}" using
     SETNX or Redis's Boolean-returning setIfAbsent with a 5-minute TTL.
     If the key already existed (duplicate event), log it and drop
     (do NOT republish it downstream).
   - If validation fails: publish the raw payload + a "reason" string to
     telemetry.dlq and stop.
   - If it passes: publish to telemetry.clean, keyed by vin.

c) HEALTH-SCORE ENGINE CONSUMER (@KafkaListener on telemetry.clean):
   For each event:
   - Read the vehicle's last known rolling stats from Redis, key
     "vehicle:rolling:{vin}" (store as a small JSON blob: lastEngineTemp,
     engineTempEwma, lastBatteryV, batteryVEwma, recentDtcCount).
   - Update using an Exponentially Weighted Moving Average (EWMA), alpha =
     0.2:  newEwma = alpha * currentValue + (1 - alpha) * oldEwma
     Do this for engineTempC and batteryV.
   - Compute a simple 0.0-1.0 riskScore from THRESHOLDS for now (we will
     swap in a real ML model later, so keep this behind a small interface
     e.g. `RiskScorer` with one method `score(RollingStats stats): double`,
     and this threshold-based version is just the first implementation):
       - engineTempEwma > 100  -> engine risk contribution high
       - batteryVEwma < 11.5   -> battery risk contribution high
       - recentDtcCount > 2 in last 10 events -> extra risk
       Combine into one riskScore 0.0-1.0 (your choice of simple weighted
       formula, but keep it readable and commented).
   - Write the updated rolling stats AND current riskScore + subsystem
     breakdown back to Redis key "vehicle:health:{vin}" (JSON, TTL 120s,
     refreshed every update) — this is what the dashboard reads.
   - IF riskScore crosses a threshold (e.g. > 0.6) AND there is no existing
     UNRESOLVED alert for this vehicle+subsystem already in Postgres, THEN:
       - Create and save a new Alert entity (severity derived from how far
         over the threshold the score is)
       - Publish the Alert (as JSON) to the "alerts" Kafka topic

d) ALERTS API (REST):
   GET  /api/v1/alerts?status=open&page=&size=   -> paginated list of open
        alerts, newest first, joined with vehicle info (vin, make, model)
   POST /api/v1/alerts/{id}/resolve              -> sets resolvedAt = now()

e) VEHICLE / HEALTH API (REST):
   GET /api/v1/vehicles?fleetId=&page=&size=     -> paginated vehicle list
   GET /api/v1/vehicles/{vin}/health             -> reads current health
        JSON straight from Redis key "vehicle:health:{vin}"; if missing in
        Redis (never seen telemetry yet), return a sensible default
        (score 0, subsystem: UNKNOWN) rather than erroring.
   GET /api/v1/fleets/{id}/summary               -> counts: total vehicles,
        open alerts by severity, average health score

====================================================================
5. CONFIGURATION
====================================================================
- application.yml (or .properties): Kafka bootstrap servers, consumer
  group ids per consumer (e.g. "normalization-group",
  "health-engine-group"), Postgres datasource URL/user/pass as
  environment-variable-driven placeholders, Redis host/port, JSON
  serialization for Kafka (use a JsonSerializer/JsonDeserializer for
  TelemetryEvent and Alert, with `spring.json.trusted.packages: "*"` for
  local dev).
- Add a docker-compose.yml at the project root spinning up: Kafka
  (KRaft mode, no separate Zookeeper needed), PostgreSQL, Redis — with
  the app's application.yml pointed at these via env vars, so
  `docker compose up` brings up dependencies and I run the Spring Boot
  app separately during development.

====================================================================
6. WHAT TO SKIP FOR NOW (do not build these yet)
====================================================================
- No Spring Security / JWT / RBAC yet — all endpoints open for now
- No Kubernetes/Helm/Terraform
- No ML model integration (the RiskScorer interface is the seam where
  that will plug in later — just keep the interface clean)
- No frontend — I'm building that separately in React
- No MongoDB yet (raw telemetry archival is a later addition)

====================================================================
7. HOW TO WORK
====================================================================
Work through this in order: (1) entities + repositories + DB config,
(2) TelemetryEvent DTO + ingestion controller + producer, (3) Kafka topic
beans, (4) normalization consumer with Redis dedup, (5) health-score
consumer with EWMA + threshold RiskScorer + alert creation, (6) alerts +
vehicles REST APIs, (7) docker-compose.yml, (8) a short README section
explaining how to run it locally. After each numbered step, show me the
files you changed so I can sanity-check before you continue to the next
step. Ask me before adding any dependency not already in the pom.xml.

====================================================================
8. LOCAL RUN & QUICK START GUIDE
====================================================================

### Prerequisites
- Docker & Docker Compose
- JDK 21
- Maven (or use `./mvnw` / `mvnw.cmd` wrapper included)

### Step 1: Start Infrastructure (Postgres, Redis, Kafka KRaft)
At project root:
```bash
docker compose up -d
```
This spins up:
- **PostgreSQL**: `localhost:5432` (db: `fleetpulse`, user: `postgres`, pass: `postgres`)
- **Redis**: `localhost:6379`
- **Apache Kafka (KRaft mode)**: `localhost:9092`

### Step 2: Build & Start Spring Boot Application
```bash
cd fleet-service
./mvnw spring-boot:run
```
*(On Windows PowerShell: `.\mvnw.cmd spring-boot:run`)*

### Step 3: Test Telemetry Ingestion
Post a sample single event:
```bash
curl -X POST http://localhost:8080/api/v1/telemetry/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "vin": "1HGBH41JXMN109186",
    "ts": "2026-09-27T14:00:00Z",
    "lat": 37.7749,
    "lon": -122.4194,
    "speedKmh": 65.5,
    "engineTempC": 102.5,
    "batteryV": 11.2,
    "socPct": 85.0,
    "odoKm": 14230.5,
    "dtc": ["P0118", "P0562"],
    "evt": "NORMAL",
    "seq": 1
  }'
```

Or ingest a batch:
```bash
curl -X POST http://localhost:8080/api/v1/telemetry/ingest \
  -H "Content-Type: application/json" \
  -d '[
    {
      "vin": "1HGBH41JXMN109186",
      "ts": "2026-09-27T14:01:00Z",
      "lat": 37.7750,
      "lon": -122.4195,
      "speedKmh": 70.0,
      "engineTempC": 104.0,
      "batteryV": 11.0,
      "socPct": 84.5,
      "odoKm": 14231.2,
      "dtc": ["P0118", "P0562", "P0300"],
      "evt": "DTC_RAISED",
      "seq": 2
    }
  ]'
```

### Step 4: Check Vehicle Health & Alerts APIs

1. **Get Vehicle Health Score (reads directly from Redis):**
```bash
curl -X GET http://localhost:8080/api/v1/vehicles/1HGBH41JXMN109186/health
```

2. **Get Open Alerts (paginated, joined with vehicle metadata):**
```bash
curl -X GET "http://localhost:8080/api/v1/alerts?status=open&page=0&size=20"
```

3. **Resolve an Alert:**
```bash
curl -X POST http://localhost:8080/api/v1/alerts/{alert-uuid}/resolve
```

4. **List Vehicles:**
```bash
curl -X GET "http://localhost:8080/api/v1/vehicles?page=0&size=20"
```

5. **Get Fleet Summary:**
```bash
curl -X GET http://localhost:8080/api/v1/fleets/{fleet-uuid}/summary
```
