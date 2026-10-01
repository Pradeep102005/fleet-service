import asyncio
import json
import random
import time
from datetime import datetime, timezone
import aiohttp
try:
    from confluent_kafka import Producer
    KAFKA_AVAILABLE = True
except ImportError:
    Producer = None
    KAFKA_AVAILABLE = False

# Constants
NUM_VEHICLES = 1000  # Default scale for local execution (can scale to 100,000)
KAFKA_BROKER = "localhost:9092"
TOPIC = "telemetry.raw"
REST_ENDPOINT = "http://localhost:8080/api/v1/telemetry/ingest"

# Generate deterministic VINs for fleet
VEHICLES = [f"1HGCM82633A{str(i).zfill(6)}" for i in range(NUM_VEHICLES)]

# Diagnostic Trouble Codes pool
DTC_CODES = {
    "OVERTEMP": "P0217",
    "MISFIRE": "P0301",
    "LOW_VOLTAGE": "P0562",
    "THERMOSTAT": "P0128",
    "CATALYST": "P0420"
}

US_HUBS = [
    {"name": "Chicago, IL", "min_lat": 41.70, "max_lat": 42.00, "min_lon": -88.10, "max_lon": -87.70},
    {"name": "Dallas, TX", "min_lat": 32.50, "max_lat": 33.10, "min_lon": -97.10, "max_lon": -96.50},
    {"name": "Atlanta, GA", "min_lat": 33.50, "max_lat": 34.00, "min_lon": -84.60, "max_lon": -84.10},
    {"name": "Denver, CO", "min_lat": 39.50, "max_lat": 40.00, "min_lon": -105.20, "max_lon": -104.70},
    {"name": "Phoenix, AZ", "min_lat": 33.20, "max_lat": 33.70, "min_lon": -112.30, "max_lon": -111.80},
    {"name": "Indianapolis, IN", "min_lat": 39.50, "max_lat": 40.00, "min_lon": -86.40, "max_lon": -85.90},
    {"name": "Kansas City, MO", "min_lat": 38.80, "max_lat": 39.30, "min_lon": -94.80, "max_lon": -94.30},
    {"name": "Columbus, OH", "min_lat": 39.70, "max_lat": 40.20, "min_lon": -83.20, "max_lon": -82.70},
    {"name": "Nashville, TN", "min_lat": 35.90, "max_lat": 36.40, "min_lon": -87.00, "max_lon": -86.50},
    {"name": "St. Louis, MO", "min_lat": 38.40, "max_lat": 38.80, "min_lon": -90.50, "max_lon": -90.10},
    {"name": "Salt Lake City, UT", "min_lat": 40.50, "max_lat": 40.90, "min_lon": -112.00, "max_lon": -111.70},
    {"name": "Minneapolis, MN", "min_lat": 44.80, "max_lat": 45.10, "min_lon": -93.50, "max_lon": -93.00},
    {"name": "Charlotte, NC", "min_lat": 35.00, "max_lat": 35.40, "min_lon": -81.10, "max_lon": -80.60},
    {"name": "Sacramento, CA", "min_lat": 38.30, "max_lat": 38.80, "min_lon": -121.70, "max_lon": -121.20},
    {"name": "Austin, TX", "min_lat": 30.00, "max_lat": 30.50, "min_lon": -97.90, "max_lon": -97.50},
    {"name": "San Antonio, TX", "min_lat": 29.20, "max_lat": 29.60, "min_lon": -98.70, "max_lon": -98.30},
    {"name": "Las Vegas, NV", "min_lat": 35.90, "max_lat": 36.40, "min_lon": -115.30, "max_lon": -114.90},
    {"name": "Albuquerque, NM", "min_lat": 34.90, "max_lat": 35.30, "min_lon": -106.80, "max_lon": -106.40},
    {"name": "Pittsburgh, PA", "min_lat": 40.20, "max_lat": 40.60, "min_lon": -80.20, "max_lon": -79.70},
    {"name": "Orlando, FL", "min_lat": 28.35, "max_lat": 28.70, "min_lon": -81.55, "max_lon": -81.20},
]

# Vehicle state tracking (simulating real-world physical drift & sensor dynamics)
vehicle_states = {}
for vin in VEHICLES:
    hub = random.choice(US_HUBS)
    
    # Target distribution: ~15% Red (Critical), ~20% Yellow (Warning), ~65% Green (Healthy)
    r = random.random()
    if r < 0.15:
        tier = "CRITICAL"
        is_drifting = True
        engine_temp = random.uniform(110.0, 118.0)
        coolant_temp = random.uniform(112.0, 120.0)
        battery_v = random.uniform(9.5, 10.5)
        oil_press = random.uniform(0.8, 1.4)
        brake_temp = random.uniform(110.0, 145.0)
    elif r < 0.40:
        tier = "WARNING"
        is_drifting = True
        engine_temp = random.uniform(93.5, 97.0)
        coolant_temp = random.uniform(93.0, 97.0)
        battery_v = random.uniform(11.8, 12.1)
        oil_press = random.uniform(2.2, 2.8)
        brake_temp = random.uniform(70.0, 88.0)
    else:
        tier = "HEALTHY"
        is_drifting = False
        engine_temp = random.uniform(85.0, 90.0)
        coolant_temp = random.uniform(86.0, 91.0)
        battery_v = random.uniform(12.4, 12.8)
        oil_press = random.uniform(3.4, 4.0)
        brake_temp = random.uniform(45.0, 65.0)

    vehicle_states[vin] = {
        "tier": tier,
        "engineTempC": engine_temp,
        "coolantTempC": coolant_temp,
        "oilPressureBar": oil_press,
        "brakeTempC": brake_temp,
        "batteryV": battery_v,
        "odoKm": random.uniform(1000.0, 75000.0),
        "lat": random.uniform(hub["min_lat"], hub["max_lat"]),
        "lon": random.uniform(hub["min_lon"], hub["max_lon"]),
        "hub": hub,
        "seq": 0,
        "is_drifting": is_drifting,
        "drift_type": random.choice(["COOLING", "BATTERY", "ENGINE_OIL", "BRAKES"])
    }

def generate_event(vin, inject_chaos=True):
    state = vehicle_states[vin]
    state["seq"] += 1

    # Simulate sequence skip (Missing Events)
    if inject_chaos and random.random() < 0.01:
        state["seq"] += random.randint(2, 5)
    
    # Geographic movement simulation bounded within depot region
    hub = state["hub"]
    state["lat"] = max(hub["min_lat"], min(hub["max_lat"], state["lat"] + random.uniform(-0.0004, 0.0004)))
    state["lon"] = max(hub["min_lon"], min(hub["max_lon"], state["lon"] + random.uniform(-0.0004, 0.0004)))
    state["odoKm"] += random.uniform(0.01, 0.15)
    
    # Event type & driving pattern
    evt_type = "NORMAL"
    rand_evt = random.random()
    if rand_evt < 0.03:
        evt_type = "HARSH_BRAKE"
        state["brakeTempC"] += random.uniform(15.0, 35.0)
    elif rand_evt < 0.06:
        evt_type = "HARSH_ACCEL"

    # Physics drift simulation maintaining stable health tier distribution
    if state["tier"] == "CRITICAL":
        state["engineTempC"] = max(108.0, min(120.0, state["engineTempC"] + random.uniform(-0.1, 0.3)))
        state["coolantTempC"] = max(110.0, min(122.0, state["coolantTempC"] + random.uniform(-0.1, 0.3)))
        state["batteryV"] = max(9.0, min(10.7, state["batteryV"] + random.uniform(-0.02, 0.01)))
        state["oilPressureBar"] = max(0.5, min(1.5, state["oilPressureBar"] + random.uniform(-0.01, 0.01)))
    elif state["tier"] == "WARNING":
        # Keep engine 93-97°C (above 92°C for 0.40 risk), coolant below 98°C (avoid THERMOSTAT DTC)
        # Battery 11.8-12.1V (avoid LOW_VOLTAGE DTC at 11.6V), oil > 2.0 (avoid MISFIRE DTC)
        state["engineTempC"] = max(93.0, min(97.5, state["engineTempC"] + random.uniform(-0.1, 0.1)))
        state["coolantTempC"] = max(93.0, min(97.5, state["coolantTempC"] + random.uniform(-0.1, 0.1)))
        state["batteryV"] = max(11.8, min(12.1, state["batteryV"] + random.uniform(-0.01, 0.01)))
        state["oilPressureBar"] = max(2.2, min(2.8, state["oilPressureBar"] + random.uniform(-0.01, 0.01)))
    else:
        state["engineTempC"] = max(82.0, min(89.0, state["engineTempC"] + random.uniform(-0.2, 0.2)))
        state["coolantTempC"] = max(83.0, min(90.0, state["coolantTempC"] + random.uniform(-0.2, 0.2)))
        state["batteryV"] = max(12.4, min(13.0, state["batteryV"] + random.uniform(-0.02, 0.02)))

    # Sensor noise / jitter (only for HEALTHY vehicles to avoid polluting tier distribution)
    if inject_chaos and state["tier"] == "HEALTHY" and random.random() < 0.05:
        noise_temp = random.uniform(-1.5, 1.5)
        noise_volt = random.uniform(-0.05, 0.05)
    else:
        noise_temp = 0.0
        noise_volt = 0.0

    # DTC Code generation
    dtcs = []
    if state["coolantTempC"] > 102.0 or state["engineTempC"] > 103.0:
        dtcs.append(DTC_CODES["OVERTEMP"])
    if state["coolantTempC"] > 98.0 and random.random() < 0.3:
        dtcs.append(DTC_CODES["THERMOSTAT"])
    if state["batteryV"] < 11.6:
        dtcs.append(DTC_CODES["LOW_VOLTAGE"])
    if state["oilPressureBar"] < 2.0 and random.random() < 0.4:
        dtcs.append(DTC_CODES["MISFIRE"])

    ts = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace("+00:00", "Z")

    event = {
        "vin": vin,
        "ts": ts,
        "lat": round(state["lat"], 6),
        "lon": round(state["lon"], 6),
        "speedKmh": round(random.uniform(0, 110), 1),
        "engineTempC": round(state["engineTempC"] + noise_temp, 1),
        "coolantTempC": round(state["coolantTempC"] + noise_temp, 1),
        "oilPressureBar": round(state["oilPressureBar"], 2),
        "brakeTempC": round(state["brakeTempC"], 1),
        "batteryV": round(state["batteryV"] + noise_volt, 2),
        "socPct": round(random.uniform(20.0, 95.0), 1),
        "odoKm": round(state["odoKm"], 1),
        "dtc": dtcs,
        "evt": evt_type,
        "seq": state["seq"]
    }
    return event

# Kafka Producer Config
producer_conf = {
    'bootstrap.servers': KAFKA_BROKER,
    'client.id': 'chaos-simulator',
    'queue.buffering.max.messages': 1000000,
    'linger.ms': 10,
    'batch.num.messages': 1000
}

def delivery_report(err, msg):
    if err is not None:
        pass # Handle Kafka delivery errors

async def run_kafka_simulator():
    p = Producer(producer_conf)
    print(f"Starting Kafka Chaos Telemetry Simulator for {NUM_VEHICLES} vehicles...")
    count = 0
    start_time = time.time()
    
    try:
        while True:
            for vin in VEHICLES:
                event = generate_event(vin)
                
                # Chaos: Send event
                p.produce(TOPIC, key=vin, value=json.dumps(event), callback=delivery_report)
                count += 1
                
                # Chaos: Duplicate Event simulation (2% probability)
                if random.random() < 0.02:
                    p.produce(TOPIC, key=vin, value=json.dumps(event), callback=delivery_report)
                    count += 1

                if count % 10000 == 0:
                    p.poll(0)
                    elapsed = time.time() - start_time
                    print(f"Produced {count} events (including duplicates/chaos). Rate: {count/elapsed:.2f} eps")
            
            p.poll(0)
            await asyncio.sleep(0.1)
    except KeyboardInterrupt:
        pass
    finally:
        p.flush()
        print("Kafka Simulator stopped.")

async def run_http_simulator():
    print(f"Starting HTTP Chaos Telemetry Simulator for {NUM_VEHICLES} vehicles...")
    count = 0
    start_time = time.time()
    
    async with aiohttp.ClientSession() as session:
        last_printed = 0
        try:
            while True:
                batch = []
                for vin in VEHICLES:
                    evt = generate_event(vin)
                    batch.append(evt)
                    
                    if random.random() < 0.02:
                        batch.append(evt)
                    
                    if len(batch) >= 100:
                        try:
                            async with session.post(REST_ENDPOINT, json=batch, timeout=2.0) as resp:
                                if resp.status == 202 or resp.status == 200:
                                    count += len(batch)
                                else:
                                    print(f"Failed HTTP batch: {resp.status}")
                        except Exception as e:
                            pass
                        batch = []
                        
                        if count - last_printed >= 5000:
                            elapsed = time.time() - start_time
                            print(f"Produced {count} events via HTTP (with chaos). Rate: {count/elapsed:.2f} eps")
                            last_printed = count
                            
                await asyncio.sleep(0.1)
        except KeyboardInterrupt:
            pass
        print("HTTP Simulator stopped.")

if __name__ == "__main__":
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "http"
    
    if mode == "kafka":
        asyncio.run(run_kafka_simulator())
    elif mode == "http":
        asyncio.run(run_http_simulator())
    else:
        print("Usage: python simulator.py [kafka|http]")
