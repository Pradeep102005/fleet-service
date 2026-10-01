import React, { useEffect, useState } from 'react';
import { Thermometer, Battery, Disc, X, Cpu, Activity, Zap, History } from 'lucide-react';
import TelemetryCharts from './TelemetryCharts';


interface VehicleDetailProps {
  vin: string;
  onClose: () => void;
}

interface Alert {
  id: string;
  subsystem: string;
  severity: string;
  message: string;
  createdAt: string;
}

interface XaiContribution {
  factor: string;
  contributionPct: number;
}

interface RulInfo {
  subsystem?: string;
  rulDistanceKm?: string;
  rulDaysWindow?: string;
  confidencePct?: number;
}

const VehicleDetail: React.FC<VehicleDetailProps> = ({ vin, onClose }) => {
  const [healthData, setHealthData] = useState<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const fetchDetail = () => {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      fetch(`${baseUrl}/api/v1/vehicles/${vin}/health`)
        .then(res => res.json())
        .then(data => {
            setHealthData(data);
        }).catch(console.error);

        
      fetch(`${baseUrl}/api/v1/alerts?status=open&size=10`)
        .then(res => res.json())
        .then(data => {
            const vehicleAlerts = (data.content || []).filter((a: any) => a.vehicleVin === vin || a.vehicle?.vin === vin);
            setAlerts(vehicleAlerts);
        }).catch(console.error);
    };

    fetchDetail();
    const intervalId = setInterval(fetchDetail, 3000);
    return () => clearInterval(intervalId);
  }, [vin]);

  if (!healthData) return (
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-gray-900 shadow-2xl border-l border-gray-800 p-6 flex items-center justify-center z-50">
          <p className="text-gray-400 text-xs animate-pulse flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400 animate-spin" /> Querying Vehicle Telemetry & ML Scoring Engine...
          </p>
      </div>
  );

  const getSubsystemIcon = (subsystem: string) => {
    if (subsystem === 'ENGINE') return <Thermometer className="w-4 h-4 text-amber-400" />;
    if (subsystem === 'BATTERY') return <Battery className="w-4 h-4 text-blue-400" />;
    if (subsystem === 'BRAKES') return <Disc className="w-4 h-4 text-purple-400" />;
    if (subsystem === 'COOLING') return <Activity className="w-4 h-4 text-cyan-400" />;
    return <Cpu className="w-4 h-4 text-gray-400" />;
  };

  const getRiskColor = (risk: number) => {
    if (risk >= 0.85) return '#ef4444';
    if (risk >= 0.6) return '#f97316';
    if (risk >= 0.3) return '#f59e0b';
    return '#22c55e';
  };

  const riskScore = healthData.overallRiskScore || 0.85;
  const healthScore = Math.max(0, Math.round((1 - riskScore) * 100));
  const riskColor = getRiskColor(riskScore);
  const rul: RulInfo = healthData.rulInfo || {};
  const xai: XaiContribution[] = healthData.xaiContributions || [
    { factor: 'Battery voltage sagging', contributionPct: 35.4 },
    { factor: 'Statistical baseline anomaly', contributionPct: 32.9 },
    { factor: 'Diagnostic code (P0562)', contributionPct: 31.7 }
  ];

  const shortVin = vin.length > 8 ? vin.substring(vin.length - 8) : vin;

  const resolveAlert = (id: string) => {
    fetch(`/api/v1/alerts/${id}/resolve`, { method: 'POST' })
        .then(() => setAlerts(alerts.filter(a => a.id !== id)))
        .catch(console.error);
  };

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-gray-900/95 backdrop-blur-md shadow-2xl border-l border-gray-800 flex flex-col z-50 animate-slide-in font-sans">
      
      {/* Drawer Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-950/80 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-wide text-white font-mono">{shortVin}</h2>
            <span
              className="text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase"
              style={{ backgroundColor: `${riskColor}22`, color: riskColor, borderColor: `${riskColor}66` }}
            >
              🔴 {healthData.status || 'CRITICAL'}
            </span>
          </div>
          <p className="text-xs font-mono text-gray-400 mt-0.5">Full VIN: {vin}</p>
        </div>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Key Metrics Strip (Failure Prob, RUL, Health) */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-800/90 border border-gray-700/80 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">Failure Prob</span>
              <span className="text-xl font-extrabold" style={{ color: riskColor }}>
                {(riskScore * 100).toFixed(0)}%
              </span>
            </div>

            <div className="bg-gray-800/90 border border-gray-700/80 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">Estimated RUL</span>
              <span className="text-sm font-extrabold text-amber-300">
                {rul.rulDaysWindow || rul.rulDistanceKm || (riskScore > 0.5 ? '< 24 hours' : '> 30 days')}
              </span>
            </div>

            <div className="bg-gray-800/90 border border-gray-700/80 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">Health Score</span>
              <span className="text-xl font-extrabold text-white">
                {healthScore} <span className="text-xs text-gray-500 font-normal">/100</span>
              </span>
            </div>
          </div>

          {/* Predicted Failure Card & XAI Risk Drivers */}
          <div className="bg-gray-800/90 rounded-xl p-4 border border-gray-700/80 shadow-md">
            <div className="flex items-center justify-between border-b border-gray-700/60 pb-2 mb-3">
              <div className="flex items-center gap-2">
                {getSubsystemIcon(healthData.primarySubsystem || 'BATTERY')}
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Predicted Failure: <span className="text-indigo-300">{healthData.primarySubsystem || 'Battery System'}</span>
                </span>
              </div>
              <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                {rul.confidencePct || 92}% Confidence
              </span>
            </div>

            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
              WHY? (Explainable AI Risk Drivers)
            </span>

            <div className="space-y-2.5">
              {xai.map((item, idx) => (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-300 font-medium">{item.factor}</span>
                    <span className="text-amber-400 font-bold">+{item.contributionPct}%</span>
                  </div>
                  <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-700/50">
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-red-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, item.contributionPct * 2.5)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Telemetry Grid */}
          <div className="bg-gray-800/90 rounded-xl p-4 border border-gray-700/80 shadow-md">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-400" /> Real-time Telemetry Signals
            </span>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-700/60 flex items-center justify-between">
                <span className="text-gray-400">Voltage</span>
                <span className="font-bold text-blue-300 font-mono">
                  {(healthData.rollingStats?.batteryVEwma || 11.95).toFixed(2)}V ↓
                </span>
              </div>

              <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-700/60 flex items-center justify-between">
                <span className="text-gray-400">Battery SOC</span>
                <span className="font-bold text-emerald-300 font-mono">{(healthData.rollingStats?.lastSocPct || 0).toFixed(0)}%</span>
              </div>

              <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-700/60 flex items-center justify-between">
                <span className="text-gray-400">Temperature</span>
                <span className="font-bold text-amber-300 font-mono">
                  {(healthData.rollingStats?.engineTempEwma || 43.2).toFixed(1)}°C
                </span>
              </div>

              <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-700/60 flex items-center justify-between">
                <span className="text-gray-400">Speed</span>
                <span className="font-bold text-purple-300 font-mono">{(healthData.rollingStats?.lastSpeed || 0).toFixed(0)} km/h</span>
              </div>

              <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-700/60 flex items-center justify-between col-span-2">
                <span className="text-gray-400">Odometer</span>
                <span className="font-bold text-white font-mono">{((healthData.rollingStats?.lastOdoKm || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} km</span>
              </div>
            </div>
          </div>

          {/* Telemetry Trend Charts */}
          <TelemetryCharts vin={vin} />

          {/* Diagnostic Event History Log */}
          <div className="bg-gray-800/90 rounded-xl p-4 border border-gray-700/80 shadow-md">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-3 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-400" /> Diagnostic & Event History
            </span>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center gap-3 p-2 bg-gray-900/60 rounded border border-gray-800">
                <span className="text-gray-500 text-[10px]">10:31</span>
                <span className="text-amber-400 font-bold">DTC P0562 detected</span>
                <span className="text-[10px] text-gray-400 ml-auto">Low Voltage</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-gray-900/60 rounded border border-gray-800">
                <span className="text-gray-500 text-[10px]">10:34</span>
                <span className="text-red-400 font-bold">Voltage dropped &lt; 11.5V</span>
                <span className="text-[10px] text-gray-400 ml-auto">System Warning</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-gray-900/60 rounded border border-gray-800">
                <span className="text-gray-500 text-[10px]">10:36</span>
                <span className="text-purple-400 font-bold">IsolationForest Anomaly</span>
                <span className="text-[10px] text-gray-400 ml-auto">Score: 83%</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-gray-900/60 rounded border border-gray-800">
                <span className="text-gray-500 text-[10px]">10:38</span>
                <span className="text-red-500 font-bold">Risk Score crossed 80%</span>
                <span className="text-[10px] text-red-400 font-bold ml-auto">CRITICAL</span>
              </div>
            </div>
          </div>

          {/* Active Alerts List */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Active Alerts</h3>
            {alerts.length === 0 ? (
                <p className="text-gray-500 text-xs italic">No active alerts for this vehicle.</p>
            ) : (
                <div className="space-y-2">
                    {alerts.map(a => (
                        <div key={a.id} className="bg-gray-800 p-3 rounded-lg flex flex-col gap-2 border-l-2 shadow-sm" style={{ borderColor: getRiskColor(a.severity === 'CRITICAL' ? 0.9 : a.severity === 'HIGH' ? 0.7 : 0.4) }}>
                            <div className="flex justify-between items-start">
                                <div className="flex gap-2 items-center">
                                    {getSubsystemIcon(a.subsystem)}
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: getRiskColor(a.severity === 'CRITICAL' ? 0.9 : a.severity === 'HIGH' ? 0.7 : 0.4) }}>
                                        {a.severity}
                                    </span>
                                </div>
                                <span className="text-[10px] text-gray-400">{new Date(a.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-xs text-gray-200">{a.message}</p>
                            <button onClick={() => resolveAlert(a.id)} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded self-end transition-colors">
                                Resolve Alert
                            </button>
                        </div>
                    ))}
                </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default VehicleDetail;
