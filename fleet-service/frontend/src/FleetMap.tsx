import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, ArrowUpRight } from 'lucide-react';

interface VehicleHealthBulk {
  vin: string;
  lat: number;
  lon: number;
  riskScore: number;
  subsystem: string;
}

interface FleetMapProps {
  vehicles: VehicleHealthBulk[];
  onVehicleClick: (vin: string) => void;
}

const getMarkerColor = (risk: number) => {
  if (risk >= 0.85) return '#ef4444'; // critical red
  if (risk >= 0.6) return '#f97316'; // high orange
  if (risk >= 0.3) return '#f59e0b'; // medium amber
  return '#22c55e'; // low green
};

export const getCityFromCoords = (lat: number, lon: number): string => {
  if (lat >= 41.5 && lon <= -87.0 && lon >= -89.0) return 'Chicago Depot';
  if (lat >= 32.0 && lat <= 33.5 && lon >= -97.5 && lon <= -96.0) return 'Dallas Depot';
  if (lat >= 33.0 && lat <= 34.5 && lon >= -85.0 && lon <= -83.5) return 'Atlanta Depot';
  if (lat >= 39.0 && lat <= 40.5 && lon >= -105.5 && lon <= -104.5) return 'Denver Hub';
  if (lat >= 33.0 && lat <= 34.0 && lon >= -112.5 && lon <= -111.5) return 'Phoenix Depot';
  if (lat >= 39.0 && lat <= 40.5 && lon >= -86.8 && lon <= -85.5) return 'Indianapolis Yard';
  if (lat >= 38.5 && lat <= 39.5 && lon >= -95.2 && lon <= -94.0) return 'Kansas City Depot';
  if (lat >= 39.5 && lat <= 40.5 && lon >= -83.5 && lon <= -82.5) return 'Columbus Hub';
  if (lat >= 35.5 && lat <= 36.8 && lon >= -87.5 && lon <= -86.0) return 'Nashville Transit';
  if (lat >= 38.0 && lat <= 39.0 && lon >= -90.8 && lon <= -89.8) return 'St. Louis Depot';
  if (lat >= 40.0 && lat <= 41.2 && lon >= -112.5 && lon <= -111.5) return 'Salt Lake City Depot';
  if (lat >= 44.5 && lat <= 45.5 && lon >= -94.0 && lon <= -92.5) return 'Minneapolis Hub';
  if (lat >= 34.8 && lat <= 35.8 && lon >= -81.5 && lon <= -80.3) return 'Charlotte Yard';
  if (lat >= 38.0 && lat <= 39.2 && lon >= -122.0 && lon <= -120.8) return 'Sacramento Hub';
  if (lat >= 29.8 && lat <= 30.8 && lon >= -98.2 && lon <= -97.2) return 'Austin Depot';
  if (lat >= 29.0 && lat <= 29.8 && lon >= -99.0 && lon <= -98.0) return 'San Antonio Depot';
  if (lat >= 35.5 && lat <= 36.8 && lon >= -115.8 && lon <= -114.5) return 'Las Vegas Hub';
  if (lat >= 34.5 && lat <= 35.5 && lon >= -107.2 && lon <= -106.0) return 'Albuquerque Depot';
  if (lat >= 40.0 && lat <= 40.8 && lon >= -80.5 && lon <= -79.5) return 'Pittsburgh Hub';
  if (lat >= 28.0 && lat <= 29.0 && lon >= -82.0 && lon <= -81.0) return 'Orlando Yard';
  return 'US Fleet Hub';
};

const FitBounds = ({ vehicles }: { vehicles: VehicleHealthBulk[] }) => {
  const map = useMap();
  useEffect(() => {
    if (vehicles.length > 0) {
      const lats = vehicles.map(v => v.lat).filter(l => l !== null && l !== undefined);
      const lons = vehicles.map(v => v.lon).filter(l => l !== null && l !== undefined);
      if (lats.length > 0 && lons.length > 0) {
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        
        if (isFinite(minLat) && isFinite(maxLat) && isFinite(minLon) && isFinite(maxLon)) {
          map.fitBounds([[minLat, minLon], [maxLat, maxLon]], { padding: [50, 50], maxZoom: 12 });
        }
      }
    }
  }, []);
  return null;
};

const createCustomClusterIcon = (cluster: any) => {
  const markers = cluster.getAllChildMarkers();
  let maxRisk = 0;
  markers.forEach((marker: any) => {
      const risk = marker.options.riskScore || 0;
      if (risk > maxRisk) maxRisk = risk;
  });

  const bgColor = getMarkerColor(maxRisk);
  
  return (window as any).L.divIcon({
    html: `<div style="background-color: ${bgColor}; color: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; border: 2px solid #0f172a; font-size: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.5);">${cluster.getChildCount()}</div>`,
    className: 'custom-marker-cluster',
    iconSize: [32, 32]
  });
};

const FleetMap: React.FC<FleetMapProps> = ({ vehicles, onVehicleClick }) => {
  const [mapSearch, setMapSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'HEALTHY'>('ALL');

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = !mapSearch || v.vin.toLowerCase().includes(mapSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (riskFilter === 'CRITICAL') return v.riskScore >= 0.75;
    if (riskFilter === 'HIGH') return v.riskScore >= 0.5 && v.riskScore < 0.75;
    if (riskFilter === 'HEALTHY') return v.riskScore < 0.5;
    return true;
  });

  return (
    <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-gray-800 relative z-0 flex flex-col">
      {/* Map Search & Filter Floating Overlay Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 bg-gray-900/90 backdrop-blur-md p-3 rounded-xl border border-gray-800 shadow-xl">
        <div className="flex items-center gap-2 bg-gray-800/90 px-3 py-1.5 rounded-lg border border-gray-700 w-full max-w-sm">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={mapSearch}
            onChange={e => setMapSearch(e.target.value)}
            placeholder="Search vehicle location or VIN..."
            className="bg-transparent text-xs text-white placeholder-gray-500 outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400 font-medium hidden sm:inline">Filter Map:</span>
          {(['ALL', 'CRITICAL', 'HIGH', 'HEALTHY'] as const).map(f => (
            <button
              key={f}
              onClick={() => setRiskFilter(f)}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                riskFilter === f ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <MapContainer 
        center={[39.8283, -98.5795]} 
        zoom={4} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <FitBounds vehicles={vehicles} />
        
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createCustomClusterIcon}
          maxClusterRadius={50}
        >
          {filteredVehicles.map(v => {
              if (v.lat == null || v.lon == null) return null;
              const color = getMarkerColor(v.riskScore);
              const city = getCityFromCoords(v.lat, v.lon);
              const riskPct = (v.riskScore * 100).toFixed(0);

              return (
                <CircleMarker
                  key={v.vin}
                  center={[v.lat, v.lon]}
                  radius={9}
                  pathOptions={{ 
                    fillColor: color, 
                    color: '#0f172a', 
                    weight: 2, 
                    fillOpacity: 0.95 
                  }}
                  // @ts-ignore
                  riskScore={v.riskScore}
                >
                  <Popup className="custom-leaflet-popup">
                    <div className="p-2 font-sans min-w-[200px]">
                      <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-1.5 mb-2">
                        <span className="font-mono font-bold text-gray-900 text-sm">{v.vin}</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded text-white"
                          style={{ backgroundColor: color }}
                        >
                          {v.riskScore >= 0.75 ? 'CRITICAL' : v.riskScore >= 0.5 ? 'HIGH' : 'HEALTHY'}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-gray-700 mb-3">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Failure Risk:</span>
                          <span className="font-bold text-gray-900">{riskPct}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Subsystem:</span>
                          <span className="font-semibold text-gray-800">{v.subsystem || 'COOLING'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Depot Location:</span>
                          <span className="font-medium text-blue-600 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {city.split(' ')[0]}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onVehicleClick(v.vin)}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center justify-center gap-1 shadow transition-colors"
                      >
                        View Vehicle Intelligence <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
};

export default FleetMap;
