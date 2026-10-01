import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '1m', target: 50 },   // Stay at 50 users for 1 min
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'], // 95% of requests < 200ms
  },
};

export default function () {
  const url = 'http://localhost:8080/api/v1/telemetry/ingest';
  
  const payload = JSON.stringify({
    vin: `1HGCM82633A${Math.floor(Math.random() * 100000).toString().padStart(6, '0')}`,
    ts: new Date().toISOString(),
    lat: 34.0522,
    lon: -118.2437,
    speedKmh: 60.5,
    engineTempC: 90.0,
    batteryV: 12.5,
    socPct: 85.0,
    odoKm: 15000.0,
    dtc: [],
    evt: "NORMAL",
    seq: Math.floor(Math.random() * 10000)
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);
  
  check(res, {
    'is status 202': (r) => r.status === 202,
  });
  
  sleep(1);
}
