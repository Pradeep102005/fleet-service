import React, { useEffect, useState } from 'react';
import {
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { Activity, Battery, Thermometer, Gauge } from 'lucide-react';

interface TelemetryPoint {
  timestamp: string;
  speed: number;
  engineTemperature: number;
  coolantTemperature: number;
  voltage: number;
  batterySoc: number;
  oilPressure: number;
  brakeTemperature: number;
}

interface TelemetryChartsProps {
  vin: string;
}

interface ChartConfigItem {
  label: string;
  key: keyof TelemetryPoint;
  color: string;
  gradientId: string;
  icon: React.ReactNode;
  unit: string;
  dangerThreshold?: number;
  warningThreshold?: number;
  invertDanger?: boolean;
}

const miniChartConfig: Record<string, ChartConfigItem> = {
  engineTemp: {
    label: 'Engine Temp',
    key: 'engineTemperature',
    color: '#f59e0b',
    gradientId: 'gradEngine',
    icon: <Thermometer className="w-3.5 h-3.5 text-amber-400" />,
    unit: '°C',
    dangerThreshold: 105,
    warningThreshold: 92,
  },
  voltage: {
    label: 'Battery Voltage',
    key: 'voltage',
    color: '#3b82f6',
    gradientId: 'gradVoltage',
    icon: <Battery className="w-3.5 h-3.5 text-blue-400" />,
    unit: 'V',
    dangerThreshold: 11.0,
    warningThreshold: 11.5,
    invertDanger: true,
  },
  speed: {
    label: 'Speed',
    key: 'speed',
    color: '#a855f7',
    gradientId: 'gradSpeed',
    icon: <Gauge className="w-3.5 h-3.5 text-purple-400" />,
    unit: 'km/h',
    dangerThreshold: 120,
    warningThreshold: 100,
  },
  coolantTemp: {
    label: 'Coolant Temp',
    key: 'coolantTemperature',
    color: '#06b6d4',
    gradientId: 'gradCoolant',
    icon: <Activity className="w-3.5 h-3.5 text-cyan-400" />,
    unit: '°C',
    dangerThreshold: 105,
    warningThreshold: 98,
  },
};

const CustomTooltip = ({ active, payload, unit }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    const time = payload[0].payload.timeLabel;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 shadow-xl text-xs">
        <p className="text-gray-400 text-[10px]">{time}</p>
        <p className="text-white font-bold font-mono">{typeof val === 'number' ? val.toFixed(1) : val}{unit}</p>
      </div>
    );
  }
  return null;
};

const MiniChart: React.FC<{
  data: any[];
  config: ChartConfigItem;
}> = ({ data, config }) => {
  const values = data.map(d => d[config.key]).filter(v => v != null) as number[];
  const latestValue = values.length > 0 ? values[values.length - 1] : 0;
  const prevValue = values.length > 1 ? values[values.length - 2] : latestValue;
  const delta = latestValue - prevValue;
  const deltaColor = delta > 0 ? (config.invertDanger ? 'text-red-400' : 'text-amber-400') : (config.invertDanger ? 'text-emerald-400' : 'text-emerald-400');

  return (
    <div className="bg-gray-800/90 rounded-xl p-3 border border-gray-700/80 shadow-md">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {config.icon}
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{config.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-extrabold text-white font-mono">
            {latestValue.toFixed(config.key === 'voltage' ? 2 : 1)}{config.unit}
          </span>
          {delta !== 0 && (
            <span className={`text-[10px] font-bold ${deltaColor}`}>
              {delta > 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <defs>
              <linearGradient id={config.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={config.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Tooltip content={<CustomTooltip unit={config.unit} />} />
            <Area
              type="monotone"
              dataKey={config.key}
              stroke={config.color}
              strokeWidth={1.5}
              fill={`url(#${config.gradientId})`}
              dot={false}
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ vin }) => {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchHistory = () => {
      fetch(`/api/v1/vehicles/${vin}/telemetry/history`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const mapped = data.map((d: TelemetryPoint, i: number) => ({
              ...d,
              idx: i,
              timeLabel: d.timestamp
                ? new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : `#${i}`,
            }));
            setHistory(mapped);
          }
        })
        .catch(console.error);
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [vin]);

  if (history.length < 2) {
    return (
      <div className="bg-gray-800/90 rounded-xl p-4 border border-gray-700/80 shadow-md">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-indigo-400" /> Telemetry Trends
        </span>
        <p className="text-gray-500 text-xs italic animate-pulse">Collecting telemetry data points...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5 text-indigo-400" /> Telemetry Trends (Last {history.length} readings)
      </span>
      <div className="grid grid-cols-2 gap-3">
        <MiniChart data={history} config={miniChartConfig.engineTemp} />
        <MiniChart data={history} config={miniChartConfig.voltage} />
        <MiniChart data={history} config={miniChartConfig.speed} />
        <MiniChart data={history} config={miniChartConfig.coolantTemp} />
      </div>
    </div>
  );
};

export default TelemetryCharts;
