import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Medicine, Batch } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, MapPin, Package, Bell, ChevronDown,
  Edit2, Save, X, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import { writeAudit } from '../../services/auditService';

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

  const startEdit = (batch: Batch) => {
    setEditingBatch(batch.id);
    setEditLoc({
      aisle:       batch.location?.aisle       ?? '',
      row:         batch.location?.row         ?? '',
      shelf:       batch.location?.shelf       ?? '',
      compartment: batch.location?.compartment ?? '',
    });
  };

  const saveLocation = async (batchId: string, medicineName: string) => {
    if (!profile || !currentStore) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'batches', batchId), { location: editLoc });
      await writeAudit(profile.email, currentStore.id, 'UPDATE_BATCH_LOCATION', 'batch', batchId, {
        medicine: medicineName, newLocation: editLoc,
      });
      setEditingBatch(null);
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const sendReorderReminder = async (medicine: Medicine, totalStock: number) => {
    if (!currentStore || !profile) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        storeId:     currentStore.id,
        type:        'reorder_reminder',
        title:       `Reorder Reminder: ${medicine.name}`,
        message:     `${profile.name} requests reorder. Stock: ${totalStock} ${medicine.unit}. Threshold: ${medicine.reorderThreshold}.`,
        urgency:     'warning',
        isRead:      false,
        createdAt:   new Date().toISOString(),
        medicineId:  medicine.id,
        requestedBy: profile.uid,
      });
      // Toast-style success — no alert()
    } catch (e: any) {
      console.error('Reorder reminder failed:', e);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

      {/* Toolbar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search by name, generic, or category..."
            className="glass-input w-full pl-11 py-3 text-sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowCategoryMenu(v => !v)}
            className="h-full px-4 glass-button-secondary flex items-center gap-2 text-sm"
          >
            {categoryFilter === 'All' ? 'All Categories' : categoryFilter}
            <ChevronDown size={13} />
          </button>
          <AnimatePresence>
            {showCategoryMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 top-full mt-2 w-48 glass-panel p-2 z-50 space-y-1 shadow-2xl"
              >
                {categories.map(cat => (
                  <button key={cat}
                    onClick={() => { setCategoryFilter(cat); setShowCategoryMenu(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      categoryFilter === cat
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Medicine cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredMedicines.map(med => {
          const medBatches = sortFEFO(batches.filter(b => b.medicineId === med.id));
          const totalStock = medBatches.reduce((a, b) => a + b.quantity, 0);
          const firstBatch = medBatches[0];
          const isLow      = totalStock < med.reorderThreshold;
          const isExpanded = expandedMed === med.id;
          const totalValue = totalStock * med.unitPrice;
          const nearestExpiry = firstBatch
            ? differenceInDays(new Date(firstBatch.expiryDate), new Date())
            : null;

          return (
            <div key={med.id}
              className={`glass-card flex flex-col overflow-hidden border ${isLow ? 'border-amber-500/20' : 'border-white/10'}`}>
              <div className="p-5 flex-1">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{med.category}</p>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                    isLow ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {isLow ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                    {isLow ? 'Low Stock' : 'Safe'}
                  </span>
                </div>

                <h3 className="font-bold text-lg text-white leading-tight mb-0.5">{med.name}</h3>
                <p className="text-xs text-slate-500 font-mono mb-4">{med.genericName}</p>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-white/5 rounded-lg px-2.5 py-2 text-center">
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-0.5">Stock</p>
                    <p className="text-sm font-mono font-bold text-white">{totalStock}</p>
                    <p className="text-[9px] text-slate-500">{med.unit}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2.5 py-2 text-center">
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-0.5">Value</p>
                    <p className="text-sm font-mono font-bold text-emerald-400">
                      ₹{totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1)}k` : totalValue}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2.5 py-2 text-center">
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-0.5">Expiry</p>
                    <p className={`text-sm font-mono font-bold ${
                      nearestExpiry === null ? 'text-slate-500'
                        : nearestExpiry <= 7  ? 'text-red-400'
                        : nearestExpiry <= 30 ? 'text-amber-400'
                        : 'text-slate-300'
                    }`}>
                      {nearestExpiry !== null ? `${nearestExpiry}d` : '—'}
                    </p>
                  </div>
                </div>

                {/* Location row + reorder */}
                <div className="flex items-center justify-between">
                  {firstBatch ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <MapPin size={11} className="text-blue-400 shrink-0" />
                      <span className="font-mono">
                        {firstBatch.location
                          ? `${firstBatch.location.aisle}/${firstBatch.location.row}/${firstBatch.location.shelf}`
                          : 'No location'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-600 italic">No stock</span>
                  )}
                  {isLow && (
                    <button
                      onClick={() => sendReorderReminder(med, totalStock)}
                      className="flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <Bell size={11} /> Remind
                    </button>
                  )}
                </div>
              </div>

              {/* Toggle batches */}
              <button
                onClick={() => setExpandedMed(isExpanded ? null : med.id)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-white/10 transition-colors flex items-center justify-center gap-2"
              >
                {isExpanded ? 'Hide' : `${medBatches.length} batch${medBatches.length !== 1 ? 'es' : ''}`}
                <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Batch detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/10"
                  >
                    {medBatches.length === 0 ? (
                      <p className="text-center text-xs text-slate-500 py-5">No active batches.</p>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {medBatches.map((batch, idx) => {
                          const daysLeft = differenceInDays(new Date(batch.expiryDate), new Date());
                          const isEditing = editingBatch === batch.id;

                          return (
                            <div key={batch.id} className={`p-4 ${idx === 0 ? 'bg-blue-500/5' : 'bg-navy-950/30'}`}>
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-sm text-white">{batch.batchNumber}</span>
                                  {idx === 0 && (
                                    <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase">NEXT</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-mono font-bold ${
                                    daysLeft <= 7 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-slate-400'
                                  }`}>
                                    {format(new Date(batch.expiryDate), 'MMM yyyy')} ({daysLeft}d)
                                  </span>
                                  <button
                                    onClick={() => isEditing ? setEditingBatch(null) : startEdit(batch)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-colors"
                                    title={isEditing ? 'Cancel' : 'Edit location'}
                                  >
                                    {isEditing ? <X size={12} /> : <Edit2 size={12} />}
                                  </button>
                                </div>
                              </div>

                              <p className="text-xs text-slate-400 mb-2.5">
                                Qty: <span className="font-mono font-bold text-white">{batch.quantity}</span>
                              </p>

                              {isEditing ? (
                                <div className="space-y-2.5">
                                  <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Edit Shelf Location</p>
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
                                    onClick={() => saveLocation(batch.id, med.name)}
                                    disabled={saving}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                                  >
                                    <Save size={11} />
                                    {saving ? 'Saving…' : 'Save Location'}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                  <MapPin size={11} className="text-blue-400 shrink-0" />
                                  <span className="font-mono">
                                    {batch.location
                                      ? `${batch.location.aisle}/${batch.location.row}/${batch.location.shelf}/${batch.location.compartment}`
                                      : <span className="italic text-slate-600">No location — click ✎ to set</span>
                                    }
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
            <Package size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold text-lg text-white">No inventory found</p>
            {categoryFilter !== 'All' && (
              <button onClick={() => setCategoryFilter('All')}
                className="mt-3 text-sm text-blue-400 hover:text-blue-300 font-bold underline">
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
