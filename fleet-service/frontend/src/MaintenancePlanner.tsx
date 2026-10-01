import React, { useState, useEffect } from 'react';
import { Wrench, Clock, CheckCircle2, User, Package, Plus, RefreshCw } from 'lucide-react';


export interface WorkOrder {
  id: string;
  vin: string;
  title: string;
  description: string;
  subsystem: 'ENGINE' | 'BATTERY' | 'BRAKES' | 'COOLING';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  technician: string;
  estimatedCost: number;
  estimatedDowntimeHours: number;
  spareParts: string;
  scheduledDate: string;
}

interface MaintenancePlannerProps {
  onSelectVin?: (vin: string) => void;
}

export const MaintenancePlanner: React.FC<MaintenancePlannerProps> = ({ onSelectVin }) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // New Work Order Form State
  const [newVin, setNewVin] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSubsystem, setNewSubsystem] = useState<'ENGINE' | 'BATTERY' | 'BRAKES' | 'COOLING'>('COOLING');
  const [newPriority, setNewPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [newTechnician, setNewTechnician] = useState('Senior Master Tech - Ops #4');
  const [newSpareParts, setNewSpareParts] = useState('Electric Coolant Pump (CLR-PMP-501)');

  const fetchWorkOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/work-orders');
      if (res.ok) {
        const data = await res.json();
        setWorkOrders(data);
      } else {
        // Fallback default work orders if DB empty
        setWorkOrders(getMockWorkOrders());
      }
    } catch (e) {
      setWorkOrders(getMockWorkOrders());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/v1/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {
      console.error(e);
    }
    setWorkOrders(prev =>
      prev.map(wo => (wo.id === id ? { ...wo, status: newStatus as any } : wo))
    );
  };

  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const newWo: Partial<WorkOrder> = {
      vin: newVin || 'VIN-1002',
      title: newTitle || 'Predictive Maintenance Service',
      description: 'Triggered by high statistical anomaly score and thermal escalation trend.',
      subsystem: newSubsystem,
      priority: newPriority,
      status: 'SCHEDULED',
      technician: newTechnician,
      estimatedCost: 350,
      estimatedDowntimeHours: 3,
      spareParts: newSpareParts,
      scheduledDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
    };

    try {
      const res = await fetch('/api/v1/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWo)
      });
      if (res.ok) {
        const created = await res.json();
        setWorkOrders(prev => [created, ...prev]);
      } else {
        setWorkOrders(prev => [{ ...newWo, id: `WO-${Math.floor(1000 + Math.random() * 9000)}` } as WorkOrder, ...prev]);
      }
    } catch (e) {
      setWorkOrders(prev => [{ ...newWo, id: `WO-${Math.floor(1000 + Math.random() * 9000)}` } as WorkOrder, ...prev]);
    }
    setShowCreateModal(false);
    setNewVin('');
    setNewTitle('');
  };

  const filteredOrders = filterStatus === 'ALL'
    ? workOrders
    : workOrders.filter(wo => wo.status === filterStatus);

  const priorityColor = (p: string) => {
    switch (p) {
      case 'CRITICAL': return 'bg-red-900/80 text-red-300 border-red-700';
      case 'HIGH': return 'bg-orange-900/80 text-orange-300 border-orange-700';
      case 'MEDIUM': return 'bg-amber-900/80 text-amber-300 border-amber-700';
      default: return 'bg-blue-900/80 text-blue-300 border-blue-700';
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'SCHEDULED': return 'bg-blue-950 text-blue-400 border-blue-800';
      case 'IN_PROGRESS': return 'bg-purple-950 text-purple-400 border-purple-800 animate-pulse';
      case 'COMPLETED': return 'bg-emerald-950 text-emerald-400 border-emerald-800';
      default: return 'bg-gray-800 text-gray-400 border-gray-700';
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-900 text-gray-100 p-6 overflow-hidden">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-800 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400 border border-blue-500/30">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Predictive Maintenance Planner</h2>
              <p className="text-xs text-gray-400">Automated AI dispatch & telemetry-guided work order management</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter Chips */}
          <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700 text-xs">
            {['ALL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  filterStatus === st ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={fetchWorkOrders}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
            title="Refresh Work Orders"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-blue-900/30 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" /> Create Work Order
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-auto pr-1">
        {filteredOrders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
            <Wrench className="w-12 h-12 mb-3 text-gray-600 stroke-1" />
            <p className="text-sm font-medium">No work orders match the selected filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map(wo => (
              <div
                key={wo.id}
                className="bg-gray-800/80 hover:bg-gray-800 border border-gray-700/70 hover:border-gray-600 rounded-xl p-5 flex flex-col justify-between transition-all duration-200 shadow-md group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${priorityColor(wo.priority)}`}>
                      {wo.priority} PRIORITY
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border ${statusBadge(wo.status)}`}>
                      {wo.status.replace('_', ' ')}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-1 mb-1">
                    {wo.title}
                  </h3>

                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => onSelectVin && onSelectVin(wo.vin)}
                      className="text-xs font-mono font-bold bg-gray-900 px-2 py-0.5 rounded border border-gray-700 text-blue-300 hover:text-blue-200 hover:border-blue-500 transition-colors"
                    >
                      {wo.vin}
                    </button>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-700/60 text-gray-300 font-medium">
                      {wo.subsystem}
                    </span>
                  </div>

                  <p className="text-xs text-gray-400 leading-relaxed mb-4 line-clamp-2">
                    {wo.description}
                  </p>
                </div>

                {/* Subsystem Details & Metadata */}
                <div className="border-t border-gray-700/60 pt-3 space-y-2 text-xs text-gray-300">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <User className="w-3.5 h-3.5 text-blue-400" /> Technician:
                    </span>
                    <span className="font-medium text-gray-200">{wo.technician || 'Unassigned'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <Package className="w-3.5 h-3.5 text-emerald-400" /> Spare Parts:
                    </span>
                    <span className="font-medium text-gray-200 truncate max-w-[160px]" title={wo.spareParts}>
                      {wo.spareParts || 'None'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> Est. Downtime:
                    </span>
                    <span className="font-medium text-amber-300">{wo.estimatedDowntimeHours} hrs (${wo.estimatedCost})</span>
                  </div>
                </div>

                {/* Status Transition Action Bar */}
                <div className="mt-4 pt-3 border-t border-gray-700/60 flex items-center justify-end gap-2">
                  {wo.status === 'SCHEDULED' && (
                    <button
                      onClick={() => handleStatusChange(wo.id, 'IN_PROGRESS')}
                      className="px-3 py-1 bg-purple-600/80 hover:bg-purple-600 text-white rounded text-xs font-semibold transition-colors"
                    >
                      Start Service
                    </button>
                  )}
                  {wo.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => handleStatusChange(wo.id, 'COMPLETED')}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                    </button>
                  )}
                  {wo.status === 'COMPLETED' && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Service Finished
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for Creating New Work Order */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Create Maintenance Work Order</h3>
            <form onSubmit={handleCreateWorkOrder} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Target Vehicle VIN</label>
                <input
                  type="text"
                  value={newVin}
                  onChange={e => setNewVin(e.target.value)}
                  placeholder="e.g. VIN-1002"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Work Order Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Replace Electric Coolant Assembly"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Subsystem</label>
                  <select
                    value={newSubsystem}
                    onChange={e => setNewSubsystem(e.target.value as any)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="COOLING">COOLING</option>
                    <option value="ENGINE">ENGINE</option>
                    <option value="BATTERY">BATTERY</option>
                    <option value="BRAKES">BRAKES</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as any)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Assigned Technician</label>
                <input
                  type="text"
                  value={newTechnician}
                  onChange={e => setNewTechnician(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Reserved Spare Parts</label>
                <input
                  type="text"
                  value={newSpareParts}
                  onChange={e => setNewSpareParts(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-md shadow-blue-900/40"
                >
                  Dispatch Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function getMockWorkOrders(): WorkOrder[] {
  return [
    {
      id: 'WO-8912',
      vin: 'VIN-1002',
      title: 'Predictive Coolant Pump Overhaul',
      description: 'Thermal sensor EWMA drift exceeded 104°C threshold. IsolationForest flags high risk of seizure.',
      subsystem: 'COOLING',
      priority: 'CRITICAL',
      status: 'SCHEDULED',
      technician: 'Senior Master Tech - Ops #4',
      estimatedCost: 375,
      estimatedDowntimeHours: 4,
      spareParts: 'CLR-PMP-501, CLR-THM-882',
      scheduledDate: '2026-10-02'
    },
    {
      id: 'WO-7721',
      vin: 'VIN-1045',
      title: 'Misfire Diagnostic & Spark Plug Replacement',
      description: 'DTC P0301 logged in clean telemetry stream. Cylinder 1 misfire requires coil and plug audit.',
      subsystem: 'ENGINE',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      technician: 'Powertrain Specialist - Depot B',
      estimatedCost: 210,
      estimatedDowntimeHours: 2,
      spareParts: 'ENG-SPK-102, ENG-FLT-904',
      scheduledDate: '2026-10-01'
    },
    {
      id: 'WO-6401',
      vin: 'VIN-1088',
      title: '12V Auxiliary Battery & BMS Wiring Inspection',
      description: 'Voltage sagging to 10.4V during ignition sequence. Subsystem failure prediction within 24 hours.',
      subsystem: 'BATTERY',
      priority: 'HIGH',
      status: 'SCHEDULED',
      technician: 'EV Electrical Specialist',
      estimatedCost: 290,
      estimatedDowntimeHours: 1.5,
      spareParts: 'BAT-EV-700, BAT-BMS-300',
      scheduledDate: '2026-10-03'
    },
    {
      id: 'WO-5110',
      vin: 'VIN-1012',
      title: 'Front Ceramic Brake Pad & Rotor Renewal',
      description: 'Harsh braking frequency spike paired with brake temp > 125°C. RUL calculated at < 600 km.',
      subsystem: 'BRAKES',
      priority: 'MEDIUM',
      status: 'COMPLETED',
      technician: 'Chassis Tech #2',
      estimatedCost: 250,
      estimatedDowntimeHours: 2,
      spareParts: 'BRK-PAD-004, BRK-RTR-110',
      scheduledDate: '2026-09-30'
    }
  ];
}
export default MaintenancePlanner;
