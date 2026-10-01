import React, { useState } from 'react';
import { Search, ArrowUpRight, MapPin } from 'lucide-react';
import { getCityFromCoords } from './FleetMap';

interface VehicleHealthBulk {
  vin: string;
  lat: number;
  lon: number;
  riskScore: number;
  subsystem: string;
}

interface VehiclesTableProps {
  vehicles: VehicleHealthBulk[];
  onSelectVin: (vin: string) => void;
}

export const VehiclesTable: React.FC<VehiclesTableProps> = ({ vehicles, onSelectVin }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'WARNING' | 'HEALTHY'>('ALL');
  const [sortField, setSortField] = useState<'risk' | 'vin'>('risk');

  const getRulEstimate = (risk: number) => {

    if (risk >= 0.85) return '< 24 hours';
    if (risk >= 0.6) return '2 - 3 days';
    if (risk >= 0.3) return '5 - 10 days';
    return '> 30 days';
  };

  const getStatusBadge = (risk: number) => {
    if (risk >= 0.75) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-950 text-red-400 border border-red-800 flex items-center gap-1.5 w-fit">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span> 🔴 Critical
        </span>
      );
    }
    if (risk >= 0.5) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-950 text-orange-400 border border-orange-800 flex items-center gap-1.5 w-fit">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span> 🟠 High Risk
        </span>
      );
    }
    if (risk >= 0.3) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1.5 w-fit">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span> 🟡 Warning
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1.5 w-fit">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 🟢 Healthy
      </span>
    );
  };

  const filteredVehicles = vehicles
    .filter(v => {
      const matchSearch = !searchQuery || v.vin.toLowerCase().includes(searchQuery.toLowerCase()) || (v.subsystem && v.subsystem.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchSearch) return false;

      if (statusFilter === 'CRITICAL') return v.riskScore >= 0.75;
      if (statusFilter === 'HIGH') return v.riskScore >= 0.5 && v.riskScore < 0.75;
      if (statusFilter === 'WARNING') return v.riskScore >= 0.3 && v.riskScore < 0.5;
      if (statusFilter === 'HEALTHY') return v.riskScore < 0.3;
      return true;
    })
    .sort((a, b) => {
      if (sortField === 'risk') return b.riskScore - a.riskScore;
      return a.vin.localeCompare(b.vin);
    });

  return (
    <div className="h-full w-full flex flex-col bg-gray-900 text-gray-100 p-6 overflow-hidden">
      {/* Search & Filter Header Bar */}
      <div className="bg-gray-800/90 border border-gray-700/80 rounded-2xl p-4 mb-6 shadow-xl flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 px-4 py-2 rounded-xl flex-1 max-w-md focus-within:border-blue-500 transition-colors">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 Search vehicle VIN (e.g. 3A000367), driver, subsystem..."
              className="bg-transparent text-xs text-white placeholder-gray-500 outline-none w-full font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Sort by:</span>
            <button
              onClick={() => setSortField(sortField === 'risk' ? 'vin' : 'risk')}
              className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs font-semibold text-gray-300 hover:text-white"
            >
              {sortField === 'risk' ? 'Risk Score (High ➔ Low)' : 'VIN Order'}
            </button>
          </div>
        </div>

        {/* Quick Filter Status Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'CRITICAL', 'HIGH', 'WARNING', 'HEALTHY'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 scale-105'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {st === 'ALL' ? 'All Vehicles' : st}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400">
            Showing <strong className="text-white">{filteredVehicles.length}</strong> of {vehicles.length} assets
          </span>
        </div>
      </div>

      {/* Enterprise Vehicle Table */}
      <div className="flex-1 overflow-auto border border-gray-800 rounded-2xl bg-gray-900/60 shadow-2xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-gray-800/90 text-gray-400 font-semibold border-b border-gray-800 sticky top-0 z-10 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3.5 px-4">Vehicle ID</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Failure Risk</th>
              <th className="py-3.5 px-4">Predicted Issue</th>
              <th className="py-3.5 px-4">Est. RUL</th>
              <th className="py-3.5 px-4">Depot Location</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {filteredVehicles.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-500 font-medium">
                  No vehicles matching the filter criteria.
                </td>
              </tr>
            ) : (
              filteredVehicles.map(v => {
                const shortVin = v.vin.length > 8 ? v.vin.substring(v.vin.length - 8) : v.vin;
                const riskPct = (v.riskScore * 100).toFixed(0);
                const city = getCityFromCoords(v.lat, v.lon);
                const rul = getRulEstimate(v.riskScore);

                return (
                  <tr
                    key={v.vin}
                    className="hover:bg-gray-800/80 transition-colors group cursor-pointer"
                    onClick={() => onSelectVin(v.vin)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-white group-hover:text-blue-400 transition-colors text-sm">
                        {shortVin}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">1HGCM82633{shortVin}</div>
                    </td>

                    <td className="py-3.5 px-4">{getStatusBadge(v.riskScore)}</td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3 max-w-[140px]">
                        <span className="font-bold text-white w-10 text-right">{riskPct}%</span>
                        <div className="flex-1 bg-gray-800 h-2 rounded-full overflow-hidden border border-gray-700">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              v.riskScore >= 0.75
                                ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'
                                : v.riskScore >= 0.5
                                ? 'bg-orange-500'
                                : v.riskScore >= 0.3
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${riskPct}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-gray-200 bg-gray-800 px-2.5 py-1 rounded border border-gray-700">
                        {v.subsystem || 'COOLING'} System
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-amber-300">{rul}</td>

                    <td className="py-3.5 px-4 text-gray-300">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" /> {city}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onSelectVin(v.vin);
                        }}
                        className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg font-bold border border-blue-500/30 transition-all flex items-center gap-1 ml-auto"
                      >
                        View Intelligence <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VehiclesTable;
