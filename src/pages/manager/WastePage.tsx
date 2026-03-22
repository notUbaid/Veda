import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, increment, getDocs
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Batch, WasteRecord } from '../../types';
import {
  Trash2, AlertTriangle, Search, Activity, CheckCircle2,
  Download, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { writeAudit } from '../../services/auditService';
import { emailWasteRecorded } from '../../services/emailService';
import { getRecipientEmails } from '../../services/notifyHelpers';

// Extended type for display — includes denormalised fields written at creation
interface WasteRecordDisplay extends WasteRecord {
  medicineName?: string;
  batchNumber?: string;
}

export function WastePage() {
  const { profile, currentStore, stores, setCurrentStore } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [logs, setLogs] = useState<WasteRecordDisplay[]>([]);

  const [search, setSearch] = useState('');
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('expired');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasteSuccess, setWasteSuccess] = useState(false);

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
    const u3 = onSnapshot(
      query(collection(db, 'waste_records'), where('storeId', '==', currentStore.id)),
      s => setLogs(
        s.docs
          .map(d => ({ id: d.id, ...d.data() } as WasteRecordDisplay))
          .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
      )
    );
    return () => { u1(); u2(); u3(); };
  }, [currentStore]);

  const filteredMeds = search.length > 1
    ? medicines.filter(m => m.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];

  const medBatches = selectedMed ? batches.filter(b => b.medicineId === selectedMed.id) : [];
  const selectedBatch = batches.find(b => b.id === selectedBatchId);

  const handleLogWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore || !profile || !selectedMed || !selectedBatchId) return;
    setIsSubmitting(true);
    try {
      const batch = batches.find(b => b.id === selectedBatchId);
      if (!batch || batch.quantity < qty) throw new Error('Insufficient stock in batch');

      const value = qty * selectedMed.unitPrice;

      // Denormalise medicineName and batchNumber at write time
      // so the log table always resolves correctly even if batch is later depleted
      await addDoc(collection(db, 'waste_records'), {
        storeId:      currentStore.id,
        medicineId:   selectedMed.id,
        medicineName: selectedMed.name,  // denormalised
        batchId:      selectedBatchId,
        batchNumber:  batch.batchNumber, // denormalised
        quantity:     qty,
        wasteValue:   value,
        reason,
        recordedAt:   new Date().toISOString(),
        recordedBy:   profile.uid,
        recordedByName: profile.name,
      });

      // Decrement batch qty (and mark depleted if zero)
      const newQty = batch.quantity - qty;
      await updateDoc(doc(db, 'batches', selectedBatchId), {
        quantity:   increment(-qty),
        isDepleted: newQty <= 0,
      });

      await writeAudit(profile.email, currentStore.id, 'RECORD_WASTE', 'batch', selectedBatchId, {
        medicine: selectedMed.name, batchNumber: batch.batchNumber, qty, value, reason,
      });

      emailWasteRecorded({
        recipientName:   profile.name,
        recipientEmails: getRecipientEmails(profile),
        medicineName:    selectedMed.name,
        quantity:        qty,
        reason,
        wasteValue:      value,
        storeName:       currentStore.name,
      }).catch(console.warn);

      setSelectedMed(null);
      setSelectedBatchId('');
      setQty(1);
      setSearch('');
      setWasteSuccess(true);
      setTimeout(() => setWasteSuccess(false), 3000);
    } catch (e: any) {
      alert('Failed: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalWasteValue = logs.reduce((sum, l) => sum + l.wasteValue, 0);

  const exportCSV = () => {
    const rows = [
      ['Date', 'Medicine', 'Batch', 'Qty', 'Value (₹)', 'Reason', 'Recorded By'],
      ...logs.map(l => [
        new Date(l.recordedAt).toLocaleString('en-GB'),
        l.medicineName ?? l.medicineId,
        l.batchNumber ?? l.batchId,
        l.quantity,
        l.wasteValue,
        l.reason,
        l.recordedByName ?? l.recordedBy ?? '',
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `waste_${currentStore?.name ?? 'store'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Store switcher if multi-store */}
      {stores.length > 1 && (
        <div className="flex items-center gap-2 mb-6 p-1 rounded-xl bg-white/5 border border-white/5 w-fit">
          {stores.map(s => (
            <button key={s.id}
              onClick={() => setCurrentStore(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                currentStore?.id === s.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Building2 size={11} /> {s.name.split('—')[0].trim()}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Log form */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1 space-y-4">
          <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/5">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Log Stock Waste</h3>
                <p className="text-xs text-slate-400">Record expiries, damages & losses</p>
              </div>
            </div>

            <AnimatePresence>
              {wasteSuccess && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 p-3 mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-bold">
                  <CheckCircle2 size={15} /> Waste logged. Email sent.
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleLogWaste} className="space-y-5">
              {/* Medicine search */}
              <div className="relative z-20">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">1. Search Medicine</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input type="text" className="glass-input w-full pl-9 py-3 text-sm"
                    placeholder="Type medicine name..."
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <AnimatePresence>
                  {filteredMeds.length > 0 && !selectedMed && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute w-full mt-1 bg-navy-800 border border-white/10 rounded-xl max-h-48 overflow-y-auto shadow-xl z-50">
                      {filteredMeds.map(m => (
                        <button key={m.id} type="button"
                          onClick={() => { setSelectedMed(m); setSearch(''); setSelectedBatchId(''); }}
                          className="block w-full text-left px-4 py-3 hover:bg-white/5 text-sm font-bold text-white transition-colors border-b border-white/5 last:border-0">
                          {m.name}
                          <span className="text-xs text-slate-500 font-normal block">{m.genericName}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence mode="wait">
                {selectedMed && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                      <span className="font-bold text-blue-400 text-sm">{selectedMed.name}</span>
                      <button type="button" onClick={() => { setSelectedMed(null); setSelectedBatchId(''); }}
                        className="text-xs text-slate-500 hover:text-white uppercase font-bold">Change</button>
                    </div>

                    {/* Batch selector */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">2. Select Batch</label>
                      {medBatches.length === 0 ? (
                        <p className="text-xs text-amber-400 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                          No active batches for this medicine in this store.
                        </p>
                      ) : (
                        <select className="glass-input w-full py-3 text-sm" value={selectedBatchId}
                          onChange={e => setSelectedBatchId(e.target.value)} required>
                          <option value="">Select batch...</option>
                          {medBatches.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.batchNumber} — Qty: {b.quantity} — Exp: {new Date(b.expiryDate).toLocaleDateString('en-GB')}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">3. Quantity</label>
                        <input type="number" min="1" max={selectedBatch?.quantity ?? 9999}
                          className="glass-input w-full py-3 text-center font-mono font-bold"
                          value={qty} onChange={e => setQty(Number(e.target.value))} required />
                        {selectedBatch && qty > selectedBatch.quantity && (
                          <p className="text-[10px] text-red-400 mt-1">Max: {selectedBatch.quantity}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">4. Reason</label>
                        <select className="glass-input w-full py-3 text-sm" value={reason} onChange={e => setReason(e.target.value)}>
                          <option value="expired">Expired</option>
                          <option value="damaged">Damaged</option>
                          <option value="lost">Lost</option>
                          <option value="recalled">Recalled</option>
                          <option value="contaminated">Contaminated</option>
                        </select>
                      </div>
                    </div>

                    {qty > 0 && (
                      <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-xs text-red-400 font-bold">
                        Estimated loss: ₹{(qty * selectedMed.unitPrice).toLocaleString('en-IN')}
                      </div>
                    )}

                    <button type="submit"
                      disabled={!selectedBatchId || isSubmitting || (selectedBatch ? qty > selectedBatch.quantity : false)}
                      className="w-full py-4 rounded-xl font-bold text-sm bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all disabled:opacity-50">
                      {isSubmitting ? 'Recording...' : 'Record Waste'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>

          <div className="glass-panel p-4 bg-amber-500/5 border border-amber-500/10">
            <h4 className="flex items-center gap-2 font-bold text-sm text-amber-500 mb-1.5">
              <AlertTriangle size={14} /> Audited & Irreversible
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Waste reduces batch stock in real-time and is permanently logged. An email goes to all your registered addresses.
            </p>
          </div>
        </motion.div>

        {/* Logs table */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity size={20} className="text-blue-500" />
              <h3 className="text-xl font-bold text-white">Waste Activity Log</h3>
            </div>
            <div className="flex items-center gap-3">
              {totalWasteValue > 0 && (
                <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <span className="text-xs text-slate-400">Total Loss: </span>
                  <span className="text-sm font-mono font-bold text-red-400">₹{totalWasteValue.toLocaleString('en-IN')}</span>
                </div>
              )}
              {logs.length > 0 && (
                <button onClick={exportCSV}
                  className="flex items-center gap-2 px-3 py-2 glass-button-secondary text-xs font-bold">
                  <Download size={13} /> Export CSV
                </button>
              )}
            </div>
          </div>

          <div className="glass-panel min-h-[500px] overflow-hidden">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-32 opacity-50">
                <CheckCircle2 size={48} className="mb-4" />
                <p className="font-bold text-lg text-white">No Waste Recorded</p>
                <p className="text-sm">Good stock hygiene!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/5">
                      <th className="py-4 px-5">Date</th>
                      <th className="py-4 px-4">Medicine</th>
                      <th className="py-4 px-4">Batch</th>
                      <th className="py-4 px-4 text-right">Qty Lost</th>
                      <th className="py-4 px-4 text-right">₹ Loss</th>
                      <th className="py-4 px-5">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-5 text-xs text-slate-400 font-mono whitespace-nowrap">
                          {new Date(log.recordedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-bold text-sm text-white">
                            {log.medicineName ?? medicines.find(m => m.id === log.medicineId)?.name ?? '—'}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-xs font-mono text-slate-400">
                          {/* Use denormalised batchNumber first, fallback to lookup */}
                          {log.batchNumber ?? batches.find(b => b.id === log.batchId)?.batchNumber ?? log.batchId?.slice(0, 10) ?? '—'}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-red-400">-{log.quantity}</td>
                        <td className="py-4 px-4 text-right font-mono text-slate-300">₹{log.wasteValue.toLocaleString('en-IN')}</td>
                        <td className="py-4 px-5">
                          <span className="text-[10px] font-bold uppercase tracking-widest bg-white/5 px-2 py-1 rounded text-slate-300 border border-white/10 capitalize">
                            {log.reason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
