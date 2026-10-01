# ⚡ Vercel Deployment Guide for FleetGuard Frontend

Vercel is the **fastest, easiest, and 100% free** platform to host your React Vite frontend!

---

## 🔑 Login Credentials Reminder
- **Username:** `fleetmanager`
- **Password:** `Immune@01`

---

## 🛠️ Step-by-Step Vercel Deployment

### Step 1: Go to Vercel
1. Open [vercel.com](https://vercel.com) and sign in with your **GitHub Account**.

### Step 2: Import your Repository
1. Click **"Add New..."** → **"Project"**.
2. Select your repository: **`Pradeep102005/fleet-service`**.
3. Click **Import**.

### Step 3: Configure Project Settings (CRITICAL)
In the **Configure Project** screen, set the following:

- **Framework Preset:** `Vite` (Vercel automatically detects this).
- **Root Directory:** Click **Edit** next to Root Directory and select:
  👉 `fleet-service/frontend`
- **Build Command:** `npm run build` (Leave default)
- **Output Directory:** `dist` (Leave default)

### Step 4: Click Deploy!
1. Click the big **"Deploy"** button.
2. Vercel will build your project in ~30 seconds and give you a live production URL like:
   `https://fleet-service-xxx.vercel.app`

---

## 🌐 Deploying Backend Services (Render vs Vercel)
- **Vercel** is designed specifically for **Frontend (React)** and Serverless functions.
- **Render** is ideal for long-running **Python ML**, **Java Spring Boot**, and **Simulator** services.

### Summary of Deployment Architecture:
1. **Frontend**: Hosted on **Vercel** (Free, instant global CDN)
2. **Python ML Service**: Hosted on **Render** (Free Web Service)
3. **Java Spring Boot Backend**: Hosted on **Render** (Free Web Service)
4. **Simulator**: Hosted on **Render** (Free Web Service with HTTP health check)
