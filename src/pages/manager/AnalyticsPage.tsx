import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Batch, DispenseLog, WasteRecord, Order } from '../../types';
import {
  TrendingUp, Activity, CheckCircle2, Package,
  Trash2, ShoppingCart, AlertTriangle, Building2,
  BrainCircuit, RefreshCw, Wifi, WifiOff
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { differenceInDays, subDays, format, startOfDay } from 'date-fns';
import { answerPharmacistQuery, checkOllamaHealth, getActiveModel } from '../../services/aiService';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];

export function AnalyticsPage() {
  const { currentStore, stores, setCurrentStore } = useAuth();
  const [medicines, setMedicines]   = useState<Medicine[]>([]);
  const [batches, setBatches]       = useState<Batch[]>([]);
  const [logs, setLogs]             = useState<DispenseLog[]>([]);
  const [waste, setWaste]           = useState<WasteRecord[]>([]);
  const [orders, setOrders]         = useState<Order[]>([]);

  // AI narrative
  const [aiSummary, setAiSummary]       = useState('');
  const [loadingAI, setLoadingAI]       = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (!currentStore) return;
    const u1 = onSnapshot(query(collection(db, 'medicines'), where('storeId', '==', currentStore.id)),
      s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine))));
    const u2 = onSnapshot(query(collection(db, 'batches'), where('storeId', '==', currentStore.id)),
      s => setBatches(s.docs.map(d => ({ id: d.id, ...d.data() } as Batch))));
    const u3 = onSnapshot(query(collection(db, 'dispense_logs'), where('storeId', '==', currentStore.id)),
      s => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as DispenseLog))));
    const u4 = onSnapshot(query(collection(db, 'waste_records'), where('storeId', '==', currentStore.id)),
      s => setWaste(s.docs.map(d => ({ id: d.id, ...d.data() } as WasteRecord))));
    const u5 = onSnapshot(query(collection(db, 'orders'), where('storeId', '==', currentStore.id)),
      s => setOrders(s.docs.map(d => ({ id: d.id, ...d.data() } as Order))));
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [currentStore]);

  useEffect(() => {
    checkOllamaHealth().then(r => setOllamaOnline(r.ok));
  }, []);

  // Computed metrics
  const activeBatches    = batches.filter(b => !b.isDepleted && !b.isDisposed);
  const totalInventoryValue = activeBatches.reduce((s, b) => {
    const med = medicines.find(m => m.id === b.medicineId);
    return s + b.quantity * (med?.unitPrice ?? 0);
  }, 0);
  const totalDispenseValue = logs.reduce((s, l) => s + l.totalValue, 0);
  const expiringSoon  = activeBatches.filter(b => {
    const d = differenceInDays(new Date(b.expiryDate), new Date()); return d >= 0 && d <= 30;
  }).length;
  const lowStockCount = medicines.filter(m => {
    const stock = activeBatches.filter(b => b.medicineId === m.id).reduce((s, b) => s + b.quantity, 0);
    return stock < m.reorderThreshold;
  }).length;
  const totalWasteValue = waste.reduce((s, w) => s + w.wasteValue, 0);
  const fefoCompliant   = logs.filter(l => l.fefoCompliant).length;
  const fefoCompliance  = logs.length > 0 ? Math.round((fefoCompliant / logs.length) * 100) : 100;

  // Dispense trend – 14 days
  const dispenseTrend = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = subDays(new Date(), 13 - i);
      return { date: startOfDay(d), label: format(d, 'dd MMM') };
    });
    return days.map(({ date, label }) => {
      const dayLogs = logs.filter(l => startOfDay(new Date(l.timestamp)).getTime() === date.getTime());
      return { name: label, count: dayLogs.length, value: dayLogs.reduce((s, l) => s + l.totalValue, 0) };
    });
  }, [logs]);

  // Top 6 medicines by dispense count
  const topMedicines = useMemo(() => {
    const counts: Record<string, { name: string; qty: number; value: number }> = {};
    logs.forEach(l => {
      if (!counts[l.medicineId]) {
        const med = medicines.find(m => m.id === l.medicineId);
        counts[l.medicineId] = { name: med?.name ?? l.medicineName ?? 'Unknown', qty: 0, value: 0 };
      }
      counts[l.medicineId].qty   += l.quantity;
      counts[l.medicineId].value += l.totalValue;
    });
    return Object.values(counts).sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [logs, medicines]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    medicines.forEach(m => {
      if (!m.category) return;
      const stock = activeBatches.filter(b => b.medicineId === m.id).reduce((s, b) => s + b.quantity, 0);
      cats[m.category] = (cats[m.category] ?? 0) + stock;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [medicines, activeBatches]);

  const ordersByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { counts[o.status] = (counts[o.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  // AI narrative summary
  const generateAISummary = async () => {
    if (!currentStore || loadingAI) return;
    setLoadingAI(true);
    setAiSummary('');
    try {
      const prompt = `You are analysing pharmacy analytics data for ${currentStore.name}.

Summary metrics:
- Total inventory value: ₹${totalInventoryValue.toLocaleString('en-IN')}
- Total dispense value (all time): ₹${totalDispenseValue.toLocaleString('en-IN')}
- Total waste value: ₹${totalWasteValue.toLocaleString('en-IN')}
- FEFO compliance: ${fefoCompliance}%
- Medicines expiring within 30 days: ${expiringSoon} batches
- Low stock alerts: ${lowStockCount} medicines
- Orders placed: ${orders.length} (${orders.filter(o => o.status === 'delivered').length} delivered)
- Top dispensed medicines: ${topMedicines.slice(0, 5).map(m => m.name + ' (' + m.qty + ' units)').join(', ')}

Write a concise 4-6 sentence pharmacy management summary. Highlight: key strengths, any risks (expiry, low stock, waste), and 2 specific actionable recommendations. Be direct and professional.`;

      const answer = await answerPharmacistQuery(prompt, medicines, [], logs);
      setAiSummary(answer);
    } catch (e: any) {
      setAiSummary('Could not generate summary: ' + e.message);
    } finally {
      setLoadingAI(false);
    }
  };

  const tooltipStyle = {
    backgroundColor: '#0f172a', borderColor: '#1e293b',
    borderRadius: '12px', fontSize: '12px',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* Store switcher */}
      {stores.length > 1 && (
        <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/5 w-fit">
          {stores.map(s => (
            <button key={s.id} onClick={() => setCurrentStore(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                currentStore?.id === s.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              <Building2 size={11} /> {s.name.split('—')[0].trim()}
            </button>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Inventory Value',  value: `₹${(totalInventoryValue / 1000).toFixed(1)}K`,  icon: Package,       color: 'text-emerald-400' },
          { label: 'Total Dispensed',  value: `₹${(totalDispenseValue / 1000).toFixed(1)}K`,   icon: Activity,      color: 'text-blue-400'    },
          { label: 'Total Waste',      value: `₹${(totalWasteValue / 1000).toFixed(1)}K`,      icon: Trash2,        color: 'text-red-400'     },
          { label: 'Expiring Soon',    value: expiringSoon,                                     icon: AlertTriangle, color: expiringSoon > 0 ? 'text-amber-400' : 'text-slate-400' },
          { label: 'Low Stock',        value: lowStockCount,                                    icon: ShoppingCart,  color: lowStockCount > 0  ? 'text-red-400'   : 'text-slate-400' },
          { label: 'FEFO Compliance',  value: `${fefoCompliance}%`,                             icon: CheckCircle2,  color: fefoCompliance >= 90 ? 'text-emerald-400' : 'text-amber-400' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }} className="glass-panel p-4">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{s.label}</p>
              <s.icon size={13} className={s.color} />
            </div>
            <p className={`text-xl font-mono font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* AI Narrative Summary */}
      <div className="glass-panel p-5 border-l-4 border-l-blue-500 bg-blue-500/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <BrainCircuit size={14} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                AI Analytics Summary
                {ollamaOnline === true  && <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1"><Wifi size={9} />{getActiveModel()}</span>}
                {ollamaOnline === false && <span className="text-[10px] text-red-400 font-bold flex items-center gap-1"><WifiOff size={9} />Offline</span>}
              </h3>
              <p className="text-[10px] text-slate-500">Narrative summary of your current store performance</p>
            </div>
          </div>
          <button
            onClick={generateAISummary}
            disabled={loadingAI || ollamaOnline === false}
            className="flex items-center gap-1.5 px-3 py-1.5 glass-card hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-slate-300 hover:text-white transition-all"
          >
            <RefreshCw size={12} className={loadingAI ? 'animate-spin text-blue-400' : ''} />
            {loadingAI ? 'Generating…' : aiSummary ? 'Refresh' : 'Generate Summary'}
          </button>
        </div>

        {loadingAI ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <div className="w-3.5 h-3.5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            Analysing your store data…
          </div>
        ) : aiSummary ? (
          <p className="text-sm text-slate-300 leading-relaxed">{aiSummary}</p>
        ) : (
          <p className="text-sm text-slate-500 italic">
            {ollamaOnline === false
              ? 'Start Ollama: ollama serve'
              : 'Click Generate Summary for an AI-written narrative of your store analytics.'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Dispense volume 14d */}
        <div className="glass-panel p-6">
          <h3 className="font-bold text-white mb-5 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-400" /> Dispense Volume — Last 14 Days
          </h3>
          {dispenseTrend.every(d => d.count === 0) ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No dispense data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dispenseTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} interval={2} />
                <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, 'Dispenses']} />
                <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top medicines */}
        <div className="glass-panel p-6">
          <h3 className="font-bold text-white mb-5 flex items-center gap-2">
            <Activity size={16} className="text-emerald-400" /> Top Medicines by Volume
          </h3>
          {topMedicines.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No dispense data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topMedicines} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} width={100} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, 'Units dispensed']} />
                <Bar dataKey="qty" fill="#10b981" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category stock */}
        <div className="glass-panel p-6">
          <h3 className="font-bold text-white mb-5">Stock by Category</h3>
          {categoryBreakdown.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No inventory data.</div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={categoryBreakdown} innerRadius={48} outerRadius={68} paddingAngle={3} dataKey="value">
                    {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, 'Units']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {categoryBreakdown.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-slate-400 truncate max-w-[100px]">{d.name}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-white">{d.value.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Order status */}
        <div className="glass-panel p-6">
          <h3 className="font-bold text-white mb-5">Order Status Distribution</h3>
          {ordersByStatus.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No orders yet.</div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={ordersByStatus} innerRadius={48} outerRadius={68} paddingAngle={3} dataKey="value">
                    {ordersByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {ordersByStatus.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-slate-400 capitalize">{d.name}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dispense value trend */}
        <div className="glass-panel p-6 lg:col-span-2">
          <h3 className="font-bold text-white mb-5 flex items-center gap-2">
            <Activity size={16} className="text-amber-400" /> Dispensing Value — Last 14 Days (₹)
          </h3>
          {dispenseTrend.every(d => d.value === 0) ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No value data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={dispenseTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} interval={2} />
                <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false}
                  tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Value']} />
                <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </motion.div>
  );
}
