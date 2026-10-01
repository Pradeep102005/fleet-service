import urllib.request
import json
try:
    req = urllib.request.Request("http://localhost:8080/api/v1/vehicles/health/bulk?limit=1000")
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        lats = [v['lat'] for v in data if v.get('lat') is not None]
        lons = [v['lon'] for v in data if v.get('lon') is not None]
        if lats:
            print(f"Total: {len(data)}")
            print(f"Lat: {min(lats):.2f} to {max(lats):.2f}")
            print(f"Lon: {min(lons):.2f} to {max(lons):.2f}")
            print(f"Sample: {data[0]}")
        else:
            print("No coords")
except Exception as e:
    print(e)
