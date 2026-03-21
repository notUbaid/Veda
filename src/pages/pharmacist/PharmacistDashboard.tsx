import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Medicine, Batch, DispenseLog } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Sparkles, MapPin, RefreshCw, Package, FileText, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { differenceInDays, format } from 'date-fns';
import { getAIRecommendation } from '../../services/aiService';

export function PharmacistDashboard() {
  const { currentStore } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recentLogs, setRecentLogs] = useState<DispenseLog[]>([]);
  
  const [aiRecs, setAiRecs] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    const u1 = onSnapshot(query(collection(db, 'medicines'), where('storeId', '==', currentStore.id), where('isActive', '==', true)),
      s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine))),
      e => handleFirestoreError(e, OperationType.LIST, 'medicines'));
    const u2 = onSnapshot(query(collection(db, 'batches'), where('storeId', '==', currentStore.id), where('isDepleted', '==', false)),
      s => setBatches(s.docs.map(d => ({ id: d.id, ...d.data() } as Batch))),
      e => handleFirestoreError(e, OperationType.LIST, 'batches'));
    const u3 = onSnapshot(query(collection(db, 'dispense_logs'), where('storeId', '==', currentStore.id), orderBy('timestamp', 'desc'), limit(10)),
      s => setRecentLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as DispenseLog))),
      e => handleFirestoreError(e, OperationType.LIST, 'dispense_logs'));
    return () => { u1(); u2(); u3(); };
  }, [currentStore]);

  const loadAIRecommendations = async () => {
    if (!currentStore || medicines.length === 0) return;
    setLoadingRecs(true);
    try {
      const recs = await getAIRecommendation(medicines, batches);
      setAiRecs(recs);
    } catch (e: any) {
      console.error('AI recs:', e?.message?.includes('429') ? 'Rate limit' : e);
    } finally {
      setLoadingRecs(false);
    }
  };

  const expiringThisWeek = batches.filter(b => { const d = differenceInDays(new Date(b.expiryDate), new Date()); return d >= 0 && d <= 7; }).length;
  const lowStockCount = medicines.filter(m => { const s = batches.filter(b => b.medicineId === m.id).reduce((a, b) => a + b.quantity, 0); return s < m.reorderThreshold; }).length;
  const todaysDispensesValue = recentLogs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).reduce((sum, l) => sum + l.totalValue, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* DASHBOARD STATS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Medicines', value: medicines.length, color: 'text-blue-500' },
          { label: 'Expiring This Week', value: expiringThisWeek, color: expiringThisWeek > 0 ? 'text-red-500' : 'text-emerald-500' },
          { label: 'Below Reorder Level', value: lowStockCount, color: lowStockCount > 0 ? 'text-amber-500' : 'text-emerald-500' },
          { label: "Today's Dispensing Total", value: `₹${todaysDispensesValue.toLocaleString('en-IN')}`, color: 'text-emerald-500' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-panel p-5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{s.label}</p>
            <p className={`text-2xl font-mono font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* AI RECOMMENDATION BANNER */}
      <div className="glass-panel p-6 border-l-4 border-l-blue-500 bg-blue-500/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center"><Sparkles size={16} className="text-blue-400" /></div>
            <div>
                <h3 className="font-bold text-sm text-white">AI Recommendation — Updated Today</h3>
                <p className="text-[10px] text-slate-400">Actionable insights from your inventory</p>
            </div>
          </div>
          <button onClick={loadAIRecommendations} disabled={loadingRecs} className="glass-button-secondary text-xs disabled:opacity-40">
              <RefreshCw size={14} className={loadingRecs ? 'animate-spin' : ''} />
              {aiRecs.length > 0 ? 'Refresh' : 'Generate'}
          </button>
        </div>
        {loadingRecs ? (
          <div className="flex items-center gap-3 text-slate-400 text-sm"><div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />Analyzing inventory...</div>
        ) : aiRecs.length > 0 ? (
          <div className="space-y-2">
            {aiRecs.slice(0, 4).map((rec, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${rec.urgency === 'critical' ? 'bg-red-500/5 border-red-500/20' : rec.urgency === 'warning' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${rec.urgency === 'critical' ? 'bg-red-500' : rec.urgency === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-sm text-white">{rec.medicineName}</span>
                  {rec.batchNumber && <span className="text-slate-400 text-xs ml-2">· {rec.batchNumber}</span>}
                  {rec.location && <span className="inline-flex items-center gap-1 ml-2 text-xs text-slate-400"><MapPin size={10} />{rec.location}</span>}
                  {rec.daysUntilExpiry !== undefined && <span className={`ml-2 text-xs font-bold ${rec.daysUntilExpiry <= 7 ? 'text-red-500' : 'text-amber-500'}`}>· Expires in {rec.daysUntilExpiry} days</span>}
                  <p className="text-sm text-slate-300 mt-1">{rec.action}</p>
                </div>
                {i === 0 && <span className="text-[9px] font-bold bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md uppercase flex-shrink-0 tracking-widest">DISPENSE FIRST</span>}
              </div>
            ))}
          </div>
        ) : (
            <div className="p-4 border border-dashed border-white/10 rounded-xl text-center">
                <p className="text-slate-400 text-sm">Click generate to receive AI insights on which batches to dispense deeply integrated with FEFO logic.</p>
            </div>
        )}
      </div>

      {/* RECENT ACTIVITY TABLE */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-6"><History size={18} className="text-blue-400" /><h3 className="font-bold text-lg text-white">Recent Dispensing Activity</h3></div>
        
        {recentLogs.length === 0 ? (
             <p className="text-sm text-slate-500 text-center py-6">No dispenses yet</p>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Medicine</th>
                            <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Batches</th>
                            <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Qty</th>
                            <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Total (₹)</th>
                            <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Time</th>
                            <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-widest font-mono text-right">Patient Ref</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {recentLogs.map(log => (
                            <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                                <td className="py-3 text-sm font-bold text-white flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center"><FileText size={12} className="text-blue-400"/></div>
                                    {log.medicineName}
                                </td>
                                <td className="py-3 text-xs text-slate-400 font-mono">
                                    {log.batchesUsed?.map(b => b.batchNumber).join(', ') || 'N/A'}
                                </td>
                                <td className="py-3 text-sm font-mono font-bold text-red-400">-{log.quantity}</td>
                                <td className="py-3 text-sm font-mono text-emerald-400 font-bold">₹{log.totalValue.toLocaleString('en-IN')}</td>
                                <td className="py-3 text-xs text-slate-400">{format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm')}</td>
                                <td className="py-3 text-xs text-slate-400 text-right">{log.patientRef || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>

    </motion.div>
  );
}
