# 🚀 FleetGuard Deployment Guide for Render

This repository contains the full code for **FleetGuard** (Predictive Fleet Intelligence Platform) with Authentication.

---

## 🔑 Login Credentials

- **Username:** `fleetmanager`
- **Password:** `Immune@01`

---

## 🛠 Deploying on Render (render.com)

Render allows you to deploy each microservice easily using Web Services and Background Workers.

### 1️⃣ Frontend (Vite + React)
- **Service Type:** Web Service or Static Site
- **Build Command:** `cd fleet-service/frontend && npm install && npm run build`
- **Publish Directory:** `fleet-service/frontend/dist`
- **Environment Variables:**
  - `VITE_API_URL`: `<your-backend-render-url>`

### 2️⃣ ML Service (Python + FastAPI / Flask)
- **Service Type:** Web Service (Python 3)
- **Root Directory:** `fleet-service/ml_service`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `python main.py`

### 3️⃣ Simulator Service (Python Telemetry Generator)
- **Service Type:** Background Worker (Python 3)
- **Root Directory:** `fleet-service/simulator`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `python simulator.py`

### 4️⃣ Spring Boot Backend (Java 17 / Maven)
- **Service Type:** Web Service (Docker or Java runtime)
- **Root Directory:** `fleet-service`
- **Build Command:** `./mvnw clean package -DskipTests`
- **Start Command:** `java -jar target/fleet-service-0.0.1-SNAPSHOT.jar`

---

## 💻 Local Quickstart

```bash
# 1. Start Frontend
cd fleet-service/frontend
npm run dev

# 2. Start ML Service
cd fleet-service/ml_service
python main.py

# 3. Start Telemetry Simulator
cd fleet-service/simulator
python simulator.py

# 4. Start Java Spring Boot Service
cd fleet-service
./mvnw spring-boot:run
```
