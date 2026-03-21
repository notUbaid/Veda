import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Batch, Order, WasteRecord, Notification, MLForecast } from '../../types';
import { motion } from 'framer-motion';
import {
  Package, AlertCircle, ShoppingCart, Trash2,
  BrainCircuit, TrendingUp, Bell, ArrowRight, RefreshCw
} from 'lucide-react';
import { getInventoryForecast } from '../../services/aiService';
import { differenceInDays, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function ManagerDashboard() {
  const { currentStore } = useAuth();
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [waste, setWaste] = useState<WasteRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [forecasts, setForecasts] = useState<MLForecast[]>([]);
  const [loadingForecast, setLoadingForecast] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    const u1 = onSnapshot(
      query(collection(db, 'medicines'), where('storeId', '==', currentStore.id)),
      (s) => setMedicines(s.docs.map((d) => ({ id: d.id, ...d.data() } as Medicine)))
    );
    const u2 = onSnapshot(
      query(collection(db, 'batches'), where('storeId', '==', currentStore.id), where('isDepleted', '==', false)),
      (s) => setBatches(s.docs.map((d) => ({ id: d.id, ...d.data() } as Batch)))
    );
    const u3 = onSnapshot(
      query(collection(db, 'orders'), where('storeId', '==', currentStore.id)),
      (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() } as Order)))
    );
    const u4 = onSnapshot(
      query(collection(db, 'waste_records'), where('storeId', '==', currentStore.id)),
      (s) => setWaste(s.docs.map((d) => ({ id: d.id, ...d.data() } as WasteRecord)))
    );
    const u5 = onSnapshot(
      query(collection(db, 'notifications'), where('storeId', '==', currentStore.id)),
      (s) => setNotifications(s.docs.map((d) => ({ id: d.id, ...d.data() } as Notification)))
    );
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [currentStore]);

  // Computed stats
  const totalInvValue = batches.reduce((sum, b) => {
    const med = medicines.find((m) => m.id === b.medicineId);
    return sum + b.quantity * (med?.unitPrice ?? 0);
  }, 0);

  const pendingOrders = orders.filter((o) =>
    ['pending', 'confirmed', 'dispatched'].includes(o.status)
  ).length;

  const criticalAlerts = notifications.filter(
    (n) => n.urgency === 'critical' && !n.isRead
  ).length;

  const wasteThisMonth = waste
    .filter((w) => new Date(w.recordedAt) > subDays(new Date(), 30))
    .reduce((sum, w) => sum + w.wasteValue, 0);

  const reorderReminders = notifications.filter(
    (n) => n.type === 'reorder_reminder' && !n.isRead
  );

  const expiringBatches = batches
    .filter((b) => {
      const d = differenceInDays(new Date(b.expiryDate), new Date());
      return d >= 0 && d <= 30;
    })
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  // Manual-only — no auto-fire to preserve free tier quota
  const loadForecast = async () => {
    if (!currentStore || medicines.length === 0 || loadingForecast) return;
    setLoadingForecast(true);
    try {
      const result = await getInventoryForecast(medicines, []);
      if (result?.length) setForecasts(result as MLForecast[]);
    } catch (e) {
      console.error('Forecast error:', e);
    } finally {
      setLoadingForecast(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Inventory Value" value={`₹${totalInvValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={Package} color="text-emerald-400" />
        <StatCard label="Critical Alerts" value={criticalAlerts} icon={AlertCircle} color={criticalAlerts > 0 ? 'text-red-500' : 'text-emerald-500'} />
        <StatCard label="Pending Orders" value={pendingOrders} icon={ShoppingCart} color="text-amber-500" />
        <StatCard label="Waste This Month" value={`₹${wasteThisMonth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={Trash2} color={wasteThisMonth > 0 ? 'text-red-500' : 'text-slate-400'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">

          {/* AI Order Book */}
          <div className="glass-panel p-6 border-l-4 border-l-blue-500 bg-blue-500/5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <BrainCircuit size={16} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">AI Order Book</h3>
                  <p className="text-xs text-slate-400">Click refresh to generate demand forecast</p>
                </div>
              </div>
              <button
                onClick={loadForecast}
                disabled={loadingForecast || medicines.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 glass-card hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-slate-300 hover:text-white transition-all"
              >
                <RefreshCw size={13} className={loadingForecast ? 'animate-spin text-blue-400' : ''} />
                {loadingForecast ? 'Generating...' : forecasts.length > 0 ? 'Refresh' : 'Generate'}
              </button>
            </div>

            {loadingForecast ? (
              <div className="flex items-center gap-3 text-slate-400 text-sm py-6">
                <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                Analysing consumption trends...
              </div>
            ) : forecasts.length === 0 ? (
              <div className="p-6 border border-dashed border-white/10 rounded-xl text-center">
                <BrainCircuit size={32} className="mx-auto mb-3 text-slate-600 opacity-50" />
                <p className="text-slate-400 text-sm">
                  Click <strong>Generate</strong> to get AI-powered demand forecasts and reorder recommendations.
                </p>
                <p className="text-slate-600 text-xs mt-1">Uses Gemini 1.5 Flash · Free tier · ~60s cooldown</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] text-slate-500 uppercase tracking-widest">
                      <th className="pb-3">Medicine</th>
                      <th className="pb-3 text-right">Stock</th>
                      <th className="pb-3 text-right">Daily Use</th>
                      <th className="pb-3 text-center">Order By</th>
                      <th className="pb-3 text-right">Rec. Qty</th>
                      <th className="pb-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {forecasts.slice(0, 8).map((fc, i) => (
                      <tr key={i}>
                        <td className="py-3 font-bold text-sm text-white">{(fc as any).medicineName ?? `Item ${i + 1}`}</td>
                        <td className="py-3 text-sm font-mono text-slate-300 text-right">{fc.daysOfStockRemaining?.toFixed(0) ?? '?'}d</td>
                        <td className="py-3 text-sm font-mono text-slate-400 text-right">{fc.avgDailyConsumption?.toFixed(1) ?? '0'}/d</td>
                        <td className="py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(fc.orderDeadlineDays ?? 0) <= 3 ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'}`}>
                            {fc.orderDeadlineDays ?? '?'}d
                          </span>
                        </td>
                        <td className="py-3 text-sm font-mono text-emerald-400 font-bold text-right">+{fc.recommendedOrderQty ?? '?'}</td>
                        <td className="py-3 text-center">
                          <button onClick={() => navigate('/manager/orders')} className="text-[10px] font-bold uppercase tracking-wider bg-white/10 hover:bg-blue-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition-all">
                            Order
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Expiry Timeline */}
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-amber-400" />
                <h3 className="font-bold text-white">Expiring Batches (Next 30 Days)</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">{expiringBatches.length} batches</span>
            </div>
            {expiringBatches.length === 0 ? (
              <div className="h-24 flex items-center justify-center border border-dashed border-white/10 rounded-2xl">
                <p className="text-slate-500 text-sm">No batches expiring in 30 days ✓</p>
              </div>
            ) : (
              <div className="space-y-2">
                {expiringBatches.slice(0, 6).map((b) => {
                  const med = medicines.find((m) => m.id === b.medicineId);
                  const days = differenceInDays(new Date(b.expiryDate), new Date());
                  return (
                    <div key={b.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${days <= 7 ? 'bg-red-500' : days <= 14 ? 'bg-amber-500' : 'bg-yellow-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{med?.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {b.batchNumber} · {b.location?.aisle}/{b.location?.row}/{b.location?.shelf}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-mono font-bold ${days <= 7 ? 'text-red-400' : 'text-amber-400'}`}>{days}d</p>
                        <p className="text-[10px] text-slate-500">{b.quantity} units</p>
                      </div>
                    </div>
                  );
                })}
                {expiringBatches.length > 6 && (
                  <p className="text-xs text-slate-500 text-center py-2">
                    +{expiringBatches.length - 6} more — check Inventory
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT col */}
        <div className="space-y-6">
          {/* Reorder Inbox */}
          <div className="glass-panel p-6 flex flex-col" style={{ minHeight: '280px' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-amber-500" />
                <h3 className="font-bold text-white">Reorder Inbox</h3>
              </div>
              {reorderReminders.length > 0 && (
                <span className="bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {reorderReminders.length}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto scrollbar-hide">
              {reorderReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center opacity-40 py-8">
                  <Bell size={28} className="text-slate-500 mb-2" />
                  <p className="text-slate-400 font-bold text-sm">Inbox Zero</p>
                  <p className="text-xs text-slate-600">No reorder requests</p>
                </div>
              ) : (
                reorderReminders.map((rem) => (
                  <div key={rem.id} className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mb-1">Pharmacist Request</p>
                    <p className="font-bold text-sm text-white">{rem.title}</p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{rem.message}</p>
                    <button onClick={() => navigate('/manager/orders')} className="mt-3 w-full py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition-all">
                      Go to Orders →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Nav */}
          <div className="glass-panel p-5">
            <h3 className="font-bold text-white text-sm mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'View Full Inventory', path: '/manager/inventory' },
                { label: 'Place an Order', path: '/manager/orders' },
                { label: 'Track Supply Chain', path: '/manager/supply-chain' },
                { label: 'Analytics & Charts', path: '/manager/analytics' },
                { label: 'Log Waste', path: '/manager/waste' },
              ].map((item) => (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all group">
                  <span className="text-sm text-slate-300 group-hover:text-white font-medium">{item.label}</span>
                  <ArrowRight size={14} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-5">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
        <div className="p-2 bg-white/5 rounded-lg"><Icon size={14} className={color} /></div>
      </div>
      <p className={`text-2xl font-mono font-bold ${color}`}>{value}</p>
    </motion.div>
  );
}
