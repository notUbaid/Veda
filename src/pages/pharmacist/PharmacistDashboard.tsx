import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Medicine, Batch, DispenseLog } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Sparkles, MapPin, RefreshCw, Package, FileText, History, Bot } from 'lucide-react';
import { motion } from 'framer-motion';
import { differenceInDays, format } from 'date-fns';
import { getAIRecommendation } from '../../services/aiService';
import { useOllama } from '../../hooks/useOllama';
import { AIStatusBar } from '../../components/ai/AIStatusBar';

function sortFEFO(batches: Batch[]): Batch[] {
  return [...batches]
    .filter(b => !b.isDepleted && !b.isDisposed && b.quantity > 0 && new Date(b.expiryDate) > new Date())
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
}

export function PharmacistDashboard() {
  const { currentStore } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recentLogs, setRecentLogs] = useState<DispenseLog[]>([]);
  const [aiRecs, setAiRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const ollama = useOllama();

  useEffect(() => {
    if (!currentStore) return;
    const u1 = onSnapshot(
      query(collection(db, 'medicines'), where('storeId', '==', currentStore.id), where('isActive', '==', true)),
      s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine)))
    );
    const u2 = onSnapshot(
      query(collection(db, 'batches'), where('storeId', '==', currentStore.id), where('isDepleted', '==', false)),
      s => setBatches(s.docs.map(d => ({ id: d.id, ...d.data() } as Batch)))
    );
    const u3 = onSnapshot(
      query(collection(db, 'dispense_logs'), where('storeId', '==', currentStore.id), orderBy('timestamp', 'desc'), limit(10)),
      s => setRecentLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as DispenseLog)))
    );
    return () => { u1(); u2(); u3(); };
  }, [currentStore]);

  const runRecommendations = async () => {
    if (!currentStore || medicines.length === 0 || loading) return;
    setLoading(true); setAiError('');
    try {
      const recs = await getAIRecommendation(medicines, sortFEFO(batches));
      if (recs.length === 0) setAiError('No recommendations returned — try again.');
      else setAiRecs(recs);
    } catch (e: any) {
      setAiError(e.message?.includes('fetch') ? 'Ollama not reachable. Run: ollama serve' : e.message ?? 'AI error');
    } finally { setLoading(false); }
  };

  const expiringThisWeek = batches.filter(b => {
    const d = differenceInDays(new Date(b.expiryDate), new Date());
    return d >= 0 && d <= 7;
  }).length;

  const lowStockCount = medicines.filter(m => {
    const s = sortFEFO(batches.filter(b => b.medicineId === m.id)).reduce((a, b) => a + b.quantity, 0);
    return s < m.reorderThreshold;
  }).length;

  const todaysValue = recentLogs
    .filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString())
    .reduce((sum, l) => sum + l.totalValue, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Medicines',        value: medicines.length,                                       color: 'text-blue-400'    },
          { label: 'Expiring This Week',     value: expiringThisWeek,                                      color: expiringThisWeek > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Below Reorder Level',   value: lowStockCount,                                          color: lowStockCount > 0  ? 'text-amber-400' : 'text-emerald-400' },
          { label: "Today's Dispense Total", value: `₹${todaysValue.toLocaleString('en-IN')}`,             color: 'text-emerald-400' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }} className="glass-panel p-5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{s.label}</p>
            <p className={`text-2xl font-mono font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* AI FEFO Banner */}
      <div className="glass-panel p-5 border-l-4 border-l-blue-500 bg-blue-500/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
              <Bot size={16} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                AI FEFO Recommendations
                <AIStatusBar status={ollama.status} activeModel={ollama.activeModel} onRetry={ollama.retry} />
              </h3>
              <p className="text-[10px] text-slate-500">Identifies which batches to dispense first · 100% local · no API key</p>
            </div>
          </div>
          <button
            onClick={runRecommendations}
            disabled={loading || ollama.status !== 'online' || medicines.length === 0}
            className="glass-button-secondary text-xs disabled:opacity-40 flex items-center gap-2 shrink-0"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-blue-400' : ''} />
            {loading ? 'Analysing…' : aiRecs.length > 0 ? 'Refresh' : 'Generate'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-400 text-sm py-4">
            <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            Running FEFO analysis on {medicines.length} medicines, {batches.length} batches…
          </div>
        ) : aiError ? (
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl text-sm text-red-400 space-y-2">
            <p>{aiError}</p>
            {aiError.includes('ollama') && (
              <code className="block text-[11px] font-mono bg-black/30 px-3 py-1.5 rounded text-emerald-400">ollama serve</code>
            )}
          </div>
        ) : aiRecs.length > 0 ? (
          <div className="space-y-2">
            {aiRecs.slice(0, 5).map((rec, i) => (
              <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${
                rec.urgency === 'critical' ? 'bg-red-500/5 border-red-500/20'
                  : rec.urgency === 'warning' ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-emerald-500/5 border-emerald-500/20'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                  rec.urgency === 'critical' ? 'bg-red-500' : rec.urgency === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-bold text-sm text-white">{rec.medicineName}</span>
                    {rec.batchNumber && <span className="text-[10px] text-slate-500 font-mono">{rec.batchNumber}</span>}
                    {rec.location && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <MapPin size={9} />{rec.location}
                      </span>
                    )}
                    {rec.daysUntilExpiry !== undefined && (
                      <span className={`text-[10px] font-bold ${rec.daysUntilExpiry <= 7 ? 'text-red-400' : 'text-amber-400'}`}>
                        {rec.daysUntilExpiry}d to expiry
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300">{rec.action}</p>
                </div>
                {i === 0 && (
                  <span className="text-[9px] font-bold bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md uppercase tracking-widest shrink-0">
                    First
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 border border-dashed border-white/10 rounded-xl text-center">
            <Sparkles size={22} className="mx-auto mb-2 text-slate-600" />
            <p className="text-slate-400 text-sm">
              {ollama.status === 'offline'
                ? 'Ollama is not running. Open a terminal and run: ollama serve'
                : 'Click Generate for AI-powered FEFO dispatch recommendations.'}
            </p>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-5">
          <History size={16} className="text-blue-400" />
          <h3 className="font-bold text-white">Recent Dispensing Activity</h3>
        </div>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No dispenses yet today</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  {['Medicine', 'Batches', 'Qty', 'Total', 'Time', 'Patient'].map(h => (
                    <th key={h} className="pb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentLogs.map(log => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 text-sm font-bold text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                          <FileText size={11} className="text-blue-400" />
                        </div>
                        {log.medicineName}
                      </div>
                    </td>
                    <td className="py-3 text-xs text-slate-400 font-mono">{log.batchesUsed?.map(b => b.batchNumber).join(', ') || '—'}</td>
                    <td className="py-3 text-sm font-mono font-bold text-red-400">-{log.quantity}</td>
                    <td className="py-3 text-sm font-mono text-emerald-400 font-bold">₹{log.totalValue.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-xs text-slate-400">{format(new Date(log.timestamp), 'dd MMM, HH:mm')}</td>
                    <td className="py-3 text-xs text-slate-400">{log.patientRef || '—'}</td>
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
