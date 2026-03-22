import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Batch, Order, WasteRecord, Notification, MLForecast, DispenseLog } from '../../types';
import { motion } from 'framer-motion';
import {
  Package, AlertCircle, ShoppingCart, Trash2, BrainCircuit,
  TrendingUp, Bell, ArrowRight, RefreshCw, Bot, AlertTriangle, Shield
} from 'lucide-react';
import {
  getInventoryForecast, getAIRecommendation,
  getExpiryRiskReport, getReorderAnalysis
} from '../../services/aiService';
import { useOllama } from '../../hooks/useOllama';
import { AIStatusBar } from '../../components/ai/AIStatusBar';
import { differenceInDays, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function ManagerDashboard() {
  const { currentStore } = useAuth();
  const navigate = useNavigate();
  const ollama = useOllama();

  const [medicines,      setMedicines]      = useState<Medicine[]>([]);
  const [batches,        setBatches]        = useState<Batch[]>([]);
  const [orders,         setOrders]         = useState<Order[]>([]);
  const [waste,          setWaste]          = useState<WasteRecord[]>([]);
  const [notifications,  setNotifications]  = useState<Notification[]>([]);
  const [dispenseLogs,   setDispenseLogs]   = useState<DispenseLog[]>([]);

  // AI state
  const [forecasts,       setForecasts]       = useState<any[]>([]);
  const [aiRecs,          setAiRecs]          = useState<any[]>([]);
  const [expiryRisk,      setExpiryRisk]      = useState<any[]>([]);
  const [reorderPlan,     setReorderPlan]     = useState<any[]>([]);
  const [loadingAI,       setLoadingAI]       = useState(false);
  const [aiError,         setAiError]         = useState('');

  useEffect(() => {
    if (!currentStore) return;
    const u1 = onSnapshot(query(collection(db, 'medicines'), where('storeId', '==', currentStore.id)),
      s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine))));
    const u2 = onSnapshot(query(collection(db, 'batches'), where('storeId', '==', currentStore.id), where('isDepleted', '==', false)),
      s => setBatches(s.docs.map(d => ({ id: d.id, ...d.data() } as Batch))));
    const u3 = onSnapshot(query(collection(db, 'orders'), where('storeId', '==', currentStore.id)),
      s => setOrders(s.docs.map(d => ({ id: d.id, ...d.data() } as Order))));
    const u4 = onSnapshot(query(collection(db, 'waste_records'), where('storeId', '==', currentStore.id)),
      s => setWaste(s.docs.map(d => ({ id: d.id, ...d.data() } as WasteRecord))));
    const u5 = onSnapshot(query(collection(db, 'notifications'), where('storeId', '==', currentStore.id)),
      s => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() } as Notification))));
    const u6 = onSnapshot(
      query(collection(db, 'dispense_logs'), where('storeId', '==', currentStore.id), orderBy('timestamp', 'desc'), limit(50)),
      s => setDispenseLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as DispenseLog))));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [currentStore]);

  // Run all AI analyses
  const runAllAI = async () => {
    if (!currentStore || medicines.length === 0 || loadingAI) return;
    setLoadingAI(true); setAiError('');
    try {
      const [fc, recs, expiry, reorder] = await Promise.allSettled([
        getInventoryForecast(medicines, dispenseLogs),
        getAIRecommendation(medicines, batches),
        getExpiryRiskReport(medicines, batches),
        getReorderAnalysis(medicines, batches, dispenseLogs),
      ]);
      if (fc.status      === 'fulfilled') setForecasts(fc.value);
      if (recs.status    === 'fulfilled') setAiRecs(recs.value);
      if (expiry.status  === 'fulfilled') setExpiryRisk(expiry.value);
      if (reorder.status === 'fulfilled') setReorderPlan(reorder.value);
    } catch (e: any) {
      setAiError(e.message?.includes('fetch') ? 'Ollama not reachable — run: ollama serve' : e.message ?? 'AI error');
    } finally { setLoadingAI(false); }
  };

  // Stats
  const totalInvValue  = batches.reduce((s, b) => {
    const med = medicines.find(m => m.id === b.medicineId);
    return s + b.quantity * (med?.unitPrice ?? 0);
  }, 0);
  const pendingOrders  = orders.filter(o => ['pending', 'confirmed', 'dispatched'].includes(o.status)).length;
  const criticalAlerts = notifications.filter(n => n.urgency === 'critical' && !n.isRead).length;
  const wasteThisMonth = waste.filter(w => new Date(w.recordedAt) > subDays(new Date(), 30)).reduce((s, w) => s + w.wasteValue, 0);
  const reorderReminders = notifications.filter(n => n.type === 'reorder_reminder' && !n.isRead);
  const expiringBatches  = batches
    .filter(b => { const d = differenceInDays(new Date(b.expiryDate), new Date()); return d >= 0 && d <= 30; })
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  const aiHasData = forecasts.length > 0 || aiRecs.length > 0 || expiryRisk.length > 0 || reorderPlan.length > 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Inventory Value"  value={`₹${totalInvValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={Package}     color="text-emerald-400" />
        <StatCard label="Critical Alerts"  value={criticalAlerts}   icon={AlertCircle} color={criticalAlerts > 0 ? 'text-red-400' : 'text-emerald-400'} />
        <StatCard label="Pending Orders"   value={pendingOrders}    icon={ShoppingCart} color="text-amber-400" />
        <StatCard label="Waste This Month" value={`₹${wasteThisMonth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={Trash2} color={wasteThisMonth > 0 ? 'text-red-400' : 'text-slate-500'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">

          {/* AI Command Centre */}
          <div className="glass-panel p-5 border-l-4 border-l-blue-500 bg-blue-500/5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <BrainCircuit size={16} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    AI Command Centre
                    <AIStatusBar status={ollama.status} activeModel={ollama.activeModel} onRetry={ollama.retry} />
                  </h3>
                  <p className="text-[10px] text-slate-500">Demand forecast · Reorder plan · Expiry risk · FEFO alerts · 100% local</p>
                </div>
              </div>
              <button
                onClick={runAllAI}
                disabled={loadingAI || ollama.status !== 'online' || medicines.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 glass-button-secondary text-xs disabled:opacity-40 shrink-0"
              >
                <RefreshCw size={13} className={loadingAI ? 'animate-spin text-blue-400' : ''} />
                {loadingAI ? 'Running…' : aiHasData ? 'Refresh All' : 'Run Analysis'}
              </button>
            </div>

            {loadingAI ? (
              <div className="flex items-center gap-3 text-slate-400 text-sm py-6">
                <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                Running 4 AI analyses on {medicines.length} medicines — this may take 30–60s…
              </div>
            ) : aiError ? (
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-2">
                <p className="text-sm text-red-400">{aiError}</p>
                {aiError.includes('ollama') && (
                  <code className="block text-[11px] font-mono bg-black/30 px-3 py-1.5 rounded text-emerald-400">ollama serve</code>
                )}
              </div>
            ) : !aiHasData ? (
              <div className="p-6 border border-dashed border-white/10 rounded-xl text-center">
                <BrainCircuit size={28} className="mx-auto mb-3 text-slate-600 opacity-50" />
                <p className="text-slate-400 text-sm">
                  {ollama.status === 'offline'
                    ? 'Ollama already installed — just run: ollama serve'
                    : 'Click Run Analysis for demand forecasts, reorder recommendations, and expiry risk reports.'}
                </p>
              </div>
            ) : (
              <div className="space-y-5">

                {/* Reorder Plan */}
                {reorderPlan.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <ShoppingCart size={11} /> Reorder Plan
                    </p>
                    <div className="space-y-1.5">
                      {reorderPlan.slice(0, 5).map((item, i) => (
                        <div key={i} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-sm ${
                          item.priority === 'critical' ? 'bg-red-500/5 border-red-500/20'
                          : item.priority === 'high' ? 'bg-amber-500/5 border-amber-500/20'
                          : 'bg-white/5 border-white/10'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            item.priority === 'critical' ? 'bg-red-500' : item.priority === 'high' ? 'bg-amber-500' : 'bg-blue-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-white text-xs">{item.medicineName}</span>
                            <span className="text-slate-500 text-[10px] ml-2">{item.reason}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-mono font-bold text-emerald-400">+{item.recommendedQty}</p>
                            <p className="text-[9px] text-slate-600">{item.daysUntilStockout}d left</p>
                          </div>
                          <button onClick={() => navigate('/manager/orders')}
                            className="text-[9px] font-bold uppercase text-blue-400 border border-blue-500/20 px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition-all shrink-0">
                            Order
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Expiry Risk */}
                {expiryRisk.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <AlertTriangle size={11} /> Expiry Risk
                    </p>
                    <div className="space-y-1.5">
                      {expiryRisk.slice(0, 4).map((r, i) => (
                        <div key={i} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border ${
                          r.wasteRisk === 'critical' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.wasteRisk === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-xs text-white">{r.medicineName}</span>
                            <span className="text-slate-500 text-[10px] ml-2 font-mono">{r.batchNumber}</span>
                            <p className="text-[10px] text-slate-400 mt-0.5">{r.action}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-xs font-mono font-bold ${r.daysLeft <= 7 ? 'text-red-400' : 'text-amber-400'}`}>{r.daysLeft}d</p>
                            <p className="text-[9px] text-red-400/70">₹{r.potentialWasteInr?.toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* FEFO Recommendations */}
                {aiRecs.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Bot size={11} /> FEFO Dispatch Alerts
                    </p>
                    <div className="space-y-1.5">
                      {aiRecs.slice(0, 3).map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${rec.urgency === 'critical' ? 'bg-red-500' : rec.urgency === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-xs text-white">{rec.medicineName}</span>
                            <span className="text-[10px] text-slate-500 ml-2">{rec.batchNumber}</span>
                            <p className="text-[10px] text-slate-400 mt-0.5">{rec.action}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 30-Day Forecast Table */}
                {forecasts.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <TrendingUp size={11} /> 30-Day Demand Forecast
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-white/10 text-[10px] text-slate-500 uppercase tracking-widest">
                            <th className="pb-2">Medicine</th>
                            <th className="pb-2 text-right">Days Left</th>
                            <th className="pb-2 text-right">Daily Use</th>
                            <th className="pb-2 text-center">Order By</th>
                            <th className="pb-2 text-right">Rec. Qty</th>
                            <th className="pb-2 text-right">Cost (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {forecasts.slice(0, 6).map((fc: any, i) => (
                            <tr key={i} className="hover:bg-white/5">
                              <td className="py-2 font-bold text-xs text-white">{fc.medicineName ?? `Item ${i + 1}`}</td>
                              <td className="py-2 text-xs font-mono text-right text-slate-300">{fc.daysOfStockRemaining?.toFixed(0) ?? '?'}d</td>
                              <td className="py-2 text-xs font-mono text-right text-slate-400">{fc.avgDailyConsumption?.toFixed(1) ?? '0'}/d</td>
                              <td className="py-2 text-center">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(fc.orderDeadlineDays ?? 99) <= 3 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                  {fc.orderDeadlineDays ?? '?'}d
                                </span>
                              </td>
                              <td className="py-2 text-xs font-mono font-bold text-emerald-400 text-right">+{fc.recommendedOrderQty ?? '?'}</td>
                              <td className="py-2 text-xs font-mono text-slate-400 text-right">₹{fc.estimatedCostInr?.toLocaleString('en-IN') ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>

          {/* Expiring Batches */}
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-amber-400" />
                <h3 className="font-bold text-white text-sm">Expiring Batches (Next 30 Days)</h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">{expiringBatches.length} batches</span>
            </div>
            {expiringBatches.length === 0 ? (
              <div className="h-20 flex items-center justify-center border border-dashed border-white/10 rounded-2xl">
                <p className="text-slate-500 text-sm flex items-center gap-2"><Shield size={14} className="text-emerald-500" /> No expiring batches ✓</p>
              </div>
            ) : (
              <div className="space-y-2">
                {expiringBatches.slice(0, 6).map(b => {
                  const med  = medicines.find(m => m.id === b.medicineId);
                  const days = differenceInDays(new Date(b.expiryDate), new Date());
                  return (
                    <div key={b.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${days <= 7 ? 'bg-red-500' : days <= 14 ? 'bg-amber-500' : 'bg-yellow-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{med?.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{b.batchNumber} · {b.location?.aisle}/{b.location?.row}/{b.location?.shelf}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-mono font-bold ${days <= 7 ? 'text-red-400' : 'text-amber-400'}`}>{days}d</p>
                        <p className="text-[10px] text-slate-500">{b.quantity} units</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Reorder Inbox */}
          <div className="glass-panel p-5 flex flex-col" style={{ minHeight: '260px' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-amber-400" />
                <h3 className="font-bold text-white text-sm">Reorder Inbox</h3>
              </div>
              {reorderReminders.length > 0 && (
                <span className="bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-full">{reorderReminders.length}</span>
              )}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto scrollbar-hide">
              {reorderReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center opacity-40 py-8">
                  <Bell size={24} className="text-slate-500 mb-2" />
                  <p className="text-slate-400 font-bold text-sm">Inbox Zero</p>
                </div>
              ) : (
                reorderReminders.map(rem => (
                  <div key={rem.id} className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-[9px] text-amber-500 font-bold uppercase tracking-wider mb-1">Pharmacist Request</p>
                    <p className="font-bold text-sm text-white">{rem.title}</p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{rem.message}</p>
                    <button onClick={() => navigate('/manager/orders')}
                      className="mt-3 w-full py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition-all">
                      Place Order →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-panel p-5">
            <h3 className="font-bold text-white text-sm mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Full Inventory',     path: '/manager/inventory'    },
                { label: 'Place an Order',      path: '/manager/orders'       },
                { label: 'Supply Chain',        path: '/manager/supply-chain' },
                { label: 'Analytics',           path: '/manager/analytics'    },
                { label: 'Log Waste',           path: '/manager/waste'        },
              ].map(item => (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all group">
                  <span className="text-sm text-slate-300 group-hover:text-white font-medium">{item.label}</span>
                  <ArrowRight size={13} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
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
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{label}</p>
        <div className="p-2 bg-white/5 rounded-lg"><Icon size={13} className={color} /></div>
      </div>
      <p className={`text-2xl font-mono font-bold ${color}`}>{value}</p>
    </motion.div>
  );
}
