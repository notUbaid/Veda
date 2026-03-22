import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Medicine, Batch } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, MapPin, Package, Bell, ChevronDown,
  Edit2, Save, X, AlertTriangle, CheckCircle2,
  Bot, RefreshCw, Lightbulb
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import { writeAudit } from '../../services/auditService';
import { getReorderAnalysis } from '../../services/aiService';
import { useOllama } from '../../hooks/useOllama';
import { AIStatusBar } from '../../components/ai/AIStatusBar';

function sortFEFO(batches: Batch[]): Batch[] {
  return [...batches]
    .filter(b => !b.isDepleted && !b.isDisposed && b.quantity > 0 && new Date(b.expiryDate) > new Date())
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
}

export function StockPage() {
  const { currentStore, profile } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [expandedMed, setExpandedMed] = useState<string | null>(null);

  // Location editing
  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const [editLoc, setEditLoc] = useState({ aisle: '', row: '', shelf: '', compartment: '' });
  const [saving, setSaving] = useState(false);

  // AI reorder analysis
  const ollama = useOllama();
  const [aiInsights, setAiInsights] = useState<any[]>([]);   // keyed by medicineId
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState('');

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
    return () => { u1(); u2(); };
  }, [currentStore]);

  const categories = ['All', ...Array.from(new Set(medicines.map(m => m.category).filter(Boolean))).sort()];

  const filteredMedicines = medicines.filter(m => {
    const matchSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.genericName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch && (categoryFilter === 'All' || m.category === categoryFilter);
  });

  const runAIAnalysis = async () => {
    if (!currentStore || medicines.length === 0 || loadingAI) return;
    setLoadingAI(true); setAiError('');
    try {
      const insights = await getReorderAnalysis(medicines, batches, []);
      setAiInsights(insights);
      if (insights.length === 0) setAiError('No reorder actions needed right now.');
    } catch (e: any) {
      setAiError(e.message?.includes('fetch') ? 'Ollama not running — run: ollama serve' : e.message ?? 'AI error');
    } finally { setLoadingAI(false); }
  };

  const getInsightForMed = (medId: string) =>
    aiInsights.find(i => i.medicineId === medId || i.medicineName === medicines.find(m => m.id === medId)?.name);

  const startEdit = (batch: Batch) => {
    setEditingBatch(batch.id);
    setEditLoc({
      aisle: batch.location?.aisle ?? '', row: batch.location?.row ?? '',
      shelf: batch.location?.shelf ?? '', compartment: batch.location?.compartment ?? '',
    });
  };

  const saveLocation = async (batchId: string, medicineName: string) => {
    if (!profile || !currentStore) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'batches', batchId), { location: editLoc });
      await writeAudit(profile.email, currentStore.id, 'UPDATE_BATCH_LOCATION', 'batch', batchId, { medicine: medicineName, newLocation: editLoc });
      setEditingBatch(null);
    } catch (e: any) { alert('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const sendReorderReminder = async (medicine: Medicine, totalStock: number) => {
    if (!currentStore || !profile) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        storeId: currentStore.id, type: 'reorder_reminder',
        title: `Reorder Reminder: ${medicine.name}`,
        message: `${profile.name} requests reorder. Stock: ${totalStock} ${medicine.unit}. Threshold: ${medicine.reorderThreshold}.`,
        urgency: 'warning', isRead: false, createdAt: new Date().toISOString(),
        medicineId: medicine.id, requestedBy: profile.uid,
      });
    } catch (e: any) { console.error('Reorder reminder failed:', e); }
  };

  const priorityColor = (p: string) =>
    p === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/20'
    : p === 'high'   ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    :                  'text-blue-400 bg-blue-500/10 border-blue-500/20';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
          <input type="text" placeholder="Search by name, generic, or category…"
            className="glass-input w-full pl-10 py-2.5 text-sm"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="relative">
          <button onClick={() => setShowCategoryMenu(v => !v)}
            className="h-full px-4 glass-button-secondary flex items-center gap-2 text-sm whitespace-nowrap">
            {categoryFilter === 'All' ? 'All Categories' : categoryFilter}
            <ChevronDown size={13} />
          </button>
          <AnimatePresence>
            {showCategoryMenu && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 top-full mt-2 w-48 glass-panel p-2 z-50 space-y-1 shadow-2xl">
                {categories.map(cat => (
                  <button key={cat} onClick={() => { setCategoryFilter(cat); setShowCategoryMenu(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${categoryFilter === cat ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                    {cat}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Analysis button */}
        <button
          onClick={runAIAnalysis}
          disabled={loadingAI || ollama.status !== 'online' || medicines.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-blue-300 text-xs font-bold rounded-xl transition-all disabled:opacity-40 shrink-0"
        >
          {loadingAI ? <RefreshCw size={13} className="animate-spin" /> : <Bot size={13} />}
          {loadingAI ? 'Analysing…' : aiInsights.length > 0 ? 'Refresh AI' : 'AI Analysis'}
          <AIStatusBar status={ollama.status} activeModel={ollama.activeModel} onRetry={ollama.retry} />
        </button>
      </div>

      {/* AI summary bar */}
      {aiInsights.length > 0 && (
        <div className="glass-panel p-4 border border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={14} className="text-blue-400" />
            <p className="text-xs font-bold text-white">AI Reorder Analysis — {aiInsights.length} action{aiInsights.length !== 1 ? 's' : ''} needed</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {aiInsights.slice(0, 6).map((ins, i) => (
              <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${priorityColor(ins.priority)}`}>
                <span className="capitalize">{ins.priority}:</span>
                <span className="text-white">{ins.medicineName}</span>
                <span className="opacity-70">+{ins.recommendedQty}</span>
              </div>
            ))}
            {aiInsights.length > 6 && <span className="text-[10px] text-slate-600">+{aiInsights.length - 6} more</span>}
          </div>
        </div>
      )}

      {aiError && (
        <p className="text-xs text-red-400 font-bold px-2">{aiError}</p>
      )}

      {/* Medicine cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredMedicines.map(med => {
          const medBatches    = sortFEFO(batches.filter(b => b.medicineId === med.id));
          const totalStock    = medBatches.reduce((a, b) => a + b.quantity, 0);
          const firstBatch    = medBatches[0];
          const isLow         = totalStock < med.reorderThreshold;
          const isExpanded    = expandedMed === med.id;
          const totalValue    = totalStock * med.unitPrice;
          const nearestExpiry = firstBatch ? differenceInDays(new Date(firstBatch.expiryDate), new Date()) : null;
          const aiInsight     = getInsightForMed(med.id);

          return (
            <div key={med.id} className={`glass-card flex flex-col overflow-hidden border ${
              aiInsight?.priority === 'critical' ? 'border-red-500/30'
              : aiInsight?.priority === 'high' ? 'border-amber-500/30'
              : isLow ? 'border-amber-500/20'
              : 'border-white/10'
            }`}>
              <div className="p-5 flex-1">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{med.category}</p>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 ${
                    isLow ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {isLow ? <AlertTriangle size={9} /> : <CheckCircle2 size={9} />}
                    {isLow ? 'Low' : 'Safe'}
                  </span>
                </div>

                <h3 className="font-bold text-base text-white leading-tight mb-0.5">{med.name}</h3>
                <p className="text-xs text-slate-500 font-mono mb-3">{med.genericName}</p>

                {/* AI insight chip */}
                {aiInsight && (
                  <div className={`mb-3 p-2.5 rounded-xl border text-xs ${priorityColor(aiInsight.priority)}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Bot size={11} />
                      <span className="font-bold capitalize">AI: {aiInsight.priority} priority</span>
                    </div>
                    <p className="opacity-80">{aiInsight.reason}</p>
                    <p className="font-mono font-bold mt-1">Recommend ordering +{aiInsight.recommendedQty} · ₹{aiInsight.estimatedCostInr?.toLocaleString('en-IN')}</p>
                  </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white/5 rounded-lg px-2 py-1.5 text-center">
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-0.5">Stock</p>
                    <p className="text-sm font-mono font-bold text-white">{totalStock}</p>
                    <p className="text-[9px] text-slate-500">{med.unit}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2 py-1.5 text-center">
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-0.5">Value</p>
                    <p className="text-sm font-mono font-bold text-emerald-400">
                      ₹{totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1)}k` : totalValue}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2 py-1.5 text-center">
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-0.5">Expiry</p>
                    <p className={`text-sm font-mono font-bold ${
                      nearestExpiry === null ? 'text-slate-500' : nearestExpiry <= 7 ? 'text-red-400' : nearestExpiry <= 30 ? 'text-amber-400' : 'text-slate-300'
                    }`}>{nearestExpiry !== null ? `${nearestExpiry}d` : '—'}</p>
                  </div>
                </div>

                {/* Location + reorder */}
                <div className="flex items-center justify-between">
                  {firstBatch ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <MapPin size={10} className="text-blue-400 shrink-0" />
                      <span className="font-mono text-[10px]">
                        {firstBatch.location ? `${firstBatch.location.aisle}/${firstBatch.location.row}/${firstBatch.location.shelf}` : 'No location'}
                      </span>
                    </div>
                  ) : <span className="text-[11px] text-slate-600 italic">No stock</span>}
                  {isLow && (
                    <button onClick={() => sendReorderReminder(med, totalStock)}
                      className="flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors">
                      <Bell size={10} /> Remind
                    </button>
                  )}
                </div>
              </div>

              {/* Batch toggle */}
              <button onClick={() => setExpandedMed(isExpanded ? null : med.id)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-white/10 flex items-center justify-center gap-2">
                {isExpanded ? 'Hide' : `${medBatches.length} batch${medBatches.length !== 1 ? 'es' : ''}`}
                <ChevronDown size={11} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Batch detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/10">
                    {medBatches.length === 0 ? (
                      <p className="text-center text-xs text-slate-500 py-5">No active batches.</p>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {medBatches.map((batch, idx) => {
                          const daysLeft = differenceInDays(new Date(batch.expiryDate), new Date());
                          const isEditing = editingBatch === batch.id;
                          return (
                            <div key={batch.id} className={`p-4 ${idx === 0 ? 'bg-blue-500/5' : 'bg-navy-950/30'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-sm text-white">{batch.batchNumber}</span>
                                  {idx === 0 && <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase">NEXT</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-mono font-bold ${daysLeft <= 7 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-slate-400'}`}>
                                    {format(new Date(batch.expiryDate), 'MMM yyyy')} ({daysLeft}d)
                                  </span>
                                  <button onClick={() => isEditing ? setEditingBatch(null) : startEdit(batch)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-colors">
                                    {isEditing ? <X size={11} /> : <Edit2 size={11} />}
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-slate-400 mb-2">Qty: <span className="font-mono font-bold text-white">{batch.quantity}</span></p>

                              {isEditing ? (
                                <div className="space-y-2">
                                  <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Edit Location</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {(['aisle', 'row', 'shelf', 'compartment'] as const).map(field => (
                                      <div key={field}>
                                        <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-1 capitalize">{field}</p>
                                        <input type="text" value={editLoc[field]}
                                          onChange={e => setEditLoc(prev => ({ ...prev, [field]: e.target.value }))}
                                          className="glass-input w-full py-1.5 text-xs text-center font-mono"
                                          placeholder={field === 'aisle' ? 'A' : '1'} />
                                      </div>
                                    ))}
                                  </div>
                                  <button onClick={() => saveLocation(batch.id, med.name)} disabled={saving}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg disabled:opacity-50">
                                    <Save size={11} />{saving ? 'Saving…' : 'Save Location'}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                  <MapPin size={10} className="text-blue-400 shrink-0" />
                                  <span className="font-mono text-[10px]">
                                    {batch.location
                                      ? `${batch.location.aisle}/${batch.location.row}/${batch.location.shelf}/${batch.location.compartment}`
                                      : <span className="italic text-slate-600">No location — click ✎</span>}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {filteredMedicines.length === 0 && (
          <div className="col-span-full text-center py-20 text-slate-500">
            <Package size={40} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold text-lg text-white">No inventory found</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
