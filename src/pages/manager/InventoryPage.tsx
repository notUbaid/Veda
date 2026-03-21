import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Batch } from '../../types';
import {
  Search, AlertTriangle, Package, CheckCircle2,
  ChevronDown, Building2, MapPin, Edit2, Save, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInDays } from 'date-fns';
import { writeAudit } from '../../services/auditService';

export function InventoryPage() {
  const { stores, currentStore, setCurrentStore, profile } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMed, setExpandedMed] = useState<string | null>(null);

  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const [editLoc, setEditLoc] = useState({ aisle: '', row: '', shelf: '', compartment: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    const u1 = onSnapshot(
      query(collection(db, 'medicines'), where('storeId', '==', currentStore.id)),
      s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine)))
    );
    const u2 = onSnapshot(
      query(collection(db, 'batches'), where('storeId', '==', currentStore.id), where('isDepleted', '==', false)),
      s => setBatches(s.docs.map(d => ({ id: d.id, ...d.data() } as Batch)))
    );
    return () => { u1(); u2(); };
  }, [currentStore]);

  const filteredMeds = medicines.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.genericName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startEditLoc = (batch: Batch) => {
    setEditingBatch(batch.id);
    setEditLoc({
      aisle:       batch.location?.aisle       ?? '',
      row:         batch.location?.row         ?? '',
      shelf:       batch.location?.shelf       ?? '',
      compartment: batch.location?.compartment ?? '',
    });
  };

  const saveLocation = async (batchId: string) => {
    if (!profile || !currentStore) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'batches', batchId), { location: editLoc });
      await writeAudit(profile.email, currentStore.id, 'UPDATE_BATCH_LOCATION', 'batch', batchId, editLoc);
      setEditingBatch(null);
    } catch (e: any) {
      alert('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {stores.length > 1 && (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/5 overflow-x-auto scrollbar-hide">
            {stores.map(s => (
              <button key={s.id}
                onClick={() => { setCurrentStore(s); setExpandedMed(null); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  currentStore?.id === s.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Building2 size={13} />
                {s.name.split('—')[0].trim()}
              </button>
            ))}
          </div>
        )}

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
          <input
            type="text"
            placeholder="Search by name or generic..."
            className="glass-input w-full pl-9 py-2.5 text-sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {currentStore && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/5">
            <MapPin size={13} className="text-blue-400" />
            <span className="text-xs font-bold text-slate-300 truncate max-w-[220px]">
              {currentStore.name}
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-[10px] text-slate-500 uppercase tracking-widest bg-white/5">
                <th className="py-4 pl-6 pr-4">Medicine</th>
                <th className="py-4 px-4 hidden md:table-cell">Category</th>
                <th className="py-4 px-4">Stock</th>
                <th className="py-4 px-4 hidden lg:table-cell">Value (₹)</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-6 text-right">Batches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredMeds.map(med => {
                const medBatches = batches
                  .filter(b => b.medicineId === med.id)
                  .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
                const totalQty   = medBatches.reduce((s, b) => s + b.quantity, 0);
                const isLow      = totalQty < med.reorderThreshold;
                const totalValue = totalQty * med.unitPrice;
                const isExpanded = expandedMed === med.id;

                return (
                  <React.Fragment key={med.id}>
                    <tr className="hover:bg-white/5 transition-colors group">
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isLow ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-400'}`}>
                            <Package size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">{med.name}</p>
                            <p className="text-xs text-slate-500">{med.genericName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 hidden md:table-cell text-xs text-slate-400">{med.category || '—'}</td>
                      <td className="py-4 px-4 text-sm font-mono font-bold text-white">
                        {totalQty} <span className="text-xs text-slate-500">{med.unit}</span>
                      </td>
                      <td className="py-4 px-4 hidden lg:table-cell text-sm font-mono text-emerald-400 font-bold">
                        ₹{totalValue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20 uppercase">
                            <AlertTriangle size={11} /> Low
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 uppercase">
                            <CheckCircle2 size={11} /> Safe
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setExpandedMed(isExpanded ? null : med.id)}
                          className="text-xs font-bold text-blue-400 hover:text-white px-3 py-1.5 inline-flex items-center gap-1 glass-button-secondary border border-blue-500/20"
                        >
                          {medBatches.length} batch{medBatches.length !== 1 ? 'es' : ''}
                          <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>

                    <AnimatePresence>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-navy-950/60 border-b border-white/5"
                            >
                              <div className="p-5">
                                <div className="flex items-center justify-between mb-4">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Batches — {med.name}
                                  </p>
                                  <p className="text-[10px] text-slate-600 font-mono">
                                    Reorder at: {med.reorderThreshold} {med.unit}
                                  </p>
                                </div>

                                {medBatches.length === 0 ? (
                                  <p className="text-sm text-slate-500 text-center py-6 border border-dashed border-white/10 rounded-xl">
                                    No active stock in this store.
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {medBatches.map((b, idx) => {
                                      const days = differenceInDays(new Date(b.expiryDate), new Date());
                                      const isEditing = editingBatch === b.id;
                                      return (
                                        <div key={b.id}
                                          className={`rounded-xl p-4 border transition-all ${idx === 0 ? 'bg-blue-500/5 border-blue-500/20' : 'bg-white/5 border-white/5'}`}>
                                          <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono font-bold text-sm text-white">{b.batchNumber}</span>
                                              {idx === 0 && (
                                                <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wide">
                                                  FEFO NEXT
                                                </span>
                                              )}
                                            </div>
                                            <button
                                              onClick={() => isEditing ? setEditingBatch(null) : startEditLoc(b)}
                                              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-colors"
                                            >
                                              {isEditing ? <X size={13} /> : <Edit2 size={13} />}
                                            </button>
                                          </div>

                                          <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="bg-black/20 rounded-lg px-2 py-1.5">
                                              <p className="text-[9px] text-slate-600 uppercase tracking-widest">Qty</p>
                                              <p className="text-sm font-mono font-bold text-white">{b.quantity}</p>
                                            </div>
                                            <div className="bg-black/20 rounded-lg px-2 py-1.5">
                                              <p className="text-[9px] text-slate-600 uppercase tracking-widest">Expires</p>
                                              <p className={`text-sm font-mono font-bold ${days <= 7 ? 'text-red-400' : days <= 30 ? 'text-amber-400' : 'text-slate-300'}`}>
                                                {days}d
                                              </p>
                                            </div>
                                          </div>

                                          {isEditing ? (
                                            <div className="space-y-2">
                                              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Edit Location</p>
                                              <div className="grid grid-cols-2 gap-2">
                                                {(['aisle', 'row', 'shelf', 'compartment'] as const).map(field => (
                                                  <div key={field}>
                                                    <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-1 capitalize">{field}</p>
                                                    <input
                                                      type="text"
                                                      value={editLoc[field]}
                                                      onChange={e => setEditLoc(prev => ({ ...prev, [field]: e.target.value }))}
                                                      className="glass-input w-full py-1.5 text-xs text-center font-mono"
                                                      placeholder={field === 'aisle' ? 'A' : field === 'row' ? '1' : field === 'shelf' ? '2' : '3'}
                                                    />
                                                  </div>
                                                ))}
                                              </div>
                                              <button
                                                onClick={() => saveLocation(b.id)}
                                                disabled={saving}
                                                className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                                              >
                                                <Save size={12} />
                                                {saving ? 'Saving...' : 'Save Location'}
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                              <MapPin size={11} className="text-blue-400 shrink-0" />
                                              <span className="font-mono">
                                                {b.location
                                                  ? `${b.location.aisle}/${b.location.row}/${b.location.shelf}/${b.location.compartment}`
                                                  : 'No location set'}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredMeds.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <Package size={40} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold text-white">No inventory found</p>
            <p className="text-sm mt-1">{searchQuery ? 'Try a different search.' : 'No medicines in this store yet.'}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
