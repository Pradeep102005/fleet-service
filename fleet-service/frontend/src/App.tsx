import { useEffect, useState } from 'react';
import './App.css';
import FleetMap from './FleetMap';
import VehicleDetail from './VehicleDetail';
import MaintenancePlanner from './MaintenancePlanner';
import FleetCopilotDrawer from './FleetCopilotDrawer';
import VehiclesTable from './VehiclesTable';
import LoginPage from './LoginPage';
import { Map, Grid2X2, Wrench, Sparkles, Car, Search, LogOut } from 'lucide-react';

interface FleetSummary {
  totalVehicles: number;
  avgHealthScore: number;
  counts: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
}

interface VehicleHealthBulk {
  vin: string;
  lat: number;
  lon: number;
  riskScore: number;
  subsystem: string;
}

const getColor = (risk: number) => {
  if (risk >= 0.85) return 'bg-health-red animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.7)]';
  if (risk >= 0.6) return 'bg-health-orange shadow-[0_0_10px_rgba(249,115,22,0.5)]';
  if (risk >= 0.3) return 'bg-health-amber';
  return 'bg-health-green';
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => localStorage.getItem('fleetguard_auth') === 'true'
  );
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [vehicles, setVehicles] = useState<VehicleHealthBulk[]>([]);
  const [view, setView] = useState<'GRID' | 'VEHICLES' | 'MAP' | 'MAINTENANCE'>('GRID');
  const [selectedVin, setSelectedVin] = useState<string | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = () => {
      fetch('/api/v1/vehicles/health/bulk?limit=1000')
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                setVehicles(data);
                const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
                let totalRisk = 0;

                data.forEach((v: VehicleHealthBulk) => {
                    totalRisk += v.riskScore;
                    if (v.riskScore >= 0.75) counts.CRITICAL++;
                    else if (v.riskScore >= 0.5) counts.HIGH++;
                    else if (v.riskScore >= 0.3) counts.MEDIUM++;
                    else counts.LOW++;
                });

                const avgRisk = data.length > 0 ? totalRisk / data.length : 0;
                setSummary({
                    totalVehicles: data.length,
                    avgHealthScore: avgRisk,
                    counts
                });
            }
        })
        .catch(console.error);
    };

    fetchData();
    const intervalId = setInterval(fetchData, 3000);
    return () => clearInterval(intervalId);
  }, []);

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  const handleLogout = () => {
    localStorage.removeItem('fleetguard_auth');
    setIsAuthenticated(false);
  };

  const searchResults = globalSearch.trim()
    ? vehicles.filter(v => v.vin.toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className="h-screen w-screen overflow-hidden bg-health-bg text-gray-100 flex flex-col font-sans relative">
      
      {/* 1. KPI & NAVIGATION STRIP */}
      <div className="bg-health-card shadow-md py-3 px-6 flex items-center justify-between border-b border-gray-700 z-10 flex-shrink-0">
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-wide bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">FleetPulse</h1>
              <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full font-mono">v2.0 Enterprise</span>
            </div>

            {/* Instant VIN Global Search Input & Auto-complete */}
            <div className="relative">
              <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg w-56 focus-within:w-72 focus-within:border-blue-500 transition-all">
                <Search className="w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  placeholder="🔍 Search VIN (e.g. 3A000367)..."
                  className="bg-transparent text-xs text-white placeholder-gray-500 outline-none w-full font-mono"
                />
              </div>

              {/* Instant Dropdown Search Results */}
              {isSearchFocused && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden text-xs">
                  {searchResults.map(res => (
                    <div
                      key={res.vin}
                      onClick={() => {
                        setSelectedVin(res.vin);
                        setGlobalSearch('');
                      }}
                      className="p-2.5 hover:bg-gray-800 cursor-pointer flex items-center justify-between border-b border-gray-800/60 last:border-none"
                    >
                      <div>
                        <span className="font-mono font-bold text-white text-xs">{res.vin}</span>
                        <span className="text-[10px] text-gray-400 block">{res.subsystem || 'COOLING'} System</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${res.riskScore >= 0.75 ? 'bg-red-600' : res.riskScore >= 0.5 ? 'bg-orange-500' : 'bg-emerald-600'}`}>
                        {(res.riskScore * 100).toFixed(0)}% Risk
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation View Toggles */}
            <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700 text-xs">
                <button 
                  onClick={() => setView('GRID')} 
                  className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-colors ${view === 'GRID' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    <Grid2X2 className="w-3.5 h-3.5" /> Grid
                </button>
                <button 
                  onClick={() => setView('VEHICLES')} 
                  className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-colors ${view === 'VEHICLES' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                    <Car className="w-3.5 h-3.5" /> Vehicles Table
                </button>
                <button 
                  onClick={() => setView('MAP')} 
                  className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-colors ${view === 'MAP' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    <Map className="w-3.5 h-3.5" /> Map
                </button>
                <button 
                  onClick={() => setView('MAINTENANCE')} 
                  className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-colors ${view === 'MAINTENANCE' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                >
                    <Wrench className="w-3.5 h-3.5" /> Maintenance Planner
                </button>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="text-gray-300 text-xs">
                Monitored: <span className="font-bold text-white">{summary?.totalVehicles || 0}</span>
            </div>

            {/* Exact matching status counters (Sum = totalVehicles) */}
            <div className="flex gap-1.5 text-xs font-bold">
                <span className="bg-health-red px-2 py-0.5 rounded-md text-white" title="Critical Risk Vehicles">🔴 {summary?.counts.CRITICAL || 0}</span>
                <span className="bg-health-orange px-2 py-0.5 rounded-md text-white" title="High Risk Vehicles">🟠 {summary?.counts.HIGH || 0}</span>
                <span className="bg-health-amber px-2 py-0.5 rounded-md text-gray-900" title="Warning Vehicles">🟡 {summary?.counts.MEDIUM || 0}</span>
                <span className="bg-health-green px-2 py-0.5 rounded-md text-gray-900" title="Healthy Vehicles">🟢 {summary?.counts.LOW || 0}</span>
            </div>
            
            <div className="h-5 w-px bg-gray-600 mx-1"></div>
            
            <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-300">Fleet Health:</span>
                <span className="font-bold text-white">{(summary ? (1 - summary.avgHealthScore) * 100 : 0).toFixed(1)}%</span>
                <div className={`w-3 h-3 rounded-full ${getColor(summary?.avgHealthScore || 0)}`}></div>
            </div>

            <div className="h-5 w-px bg-gray-600 mx-1"></div>

            {/* AI Copilot Agent Toggle Button */}
            <button
              onClick={() => setIsCopilotOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-900/50 transition-all hover:scale-105"
            >
              <Sparkles className="w-3.5 h-3.5 animate-spin" /> AI Copilot
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-red-950/60 border border-gray-700 hover:border-red-800 text-gray-400 hover:text-red-400 rounded-lg text-xs font-semibold transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-auto relative p-6">
          {view === 'GRID' && (
            <div className="h-full flex flex-col">
              <h2 className="text-lg font-semibold mb-4 text-gray-300 flex-shrink-0">Fleet Health Matrix (Real-time ML Stream)</h2>
              <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(1.5rem,1fr))] gap-[2px]">
                    {vehicles.map((v) => (
                        <div
                            key={v.vin}
                            title={`VIN: ${v.vin} | Risk: ${(v.riskScore*100).toFixed(1)}%`}
                            className={`h-6 rounded-sm cursor-pointer transition-colors duration-500 hover:ring-2 hover:ring-white ${getColor(v.riskScore)}`}
                            onClick={() => setSelectedVin(v.vin)}
                        ></div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {view === 'VEHICLES' && (
            <div className="h-full w-full">
               <VehiclesTable vehicles={vehicles} onSelectVin={(vin) => setSelectedVin(vin)} />
            </div>
          )}

          {view === 'MAP' && (
            <div className="h-full w-full">
               <FleetMap vehicles={vehicles} onVehicleClick={setSelectedVin} />
            </div>
          )}

          {view === 'MAINTENANCE' && (
            <div className="h-full w-full">
               <MaintenancePlanner onSelectVin={(vin) => setSelectedVin(vin)} />
            </div>
          )}
      </div>

      {/* VEHICLE DETAIL DRAWER */}
      {selectedVin && (
          <VehicleDetail vin={selectedVin} onClose={() => setSelectedVin(null)} />
      )}

      {/* LANGGRAPH AI COPILOT DRAWER */}
      <FleetCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        onSelectVin={(vin) => setSelectedVin(vin)}
      />
    </div>
  );
}

export default App;
