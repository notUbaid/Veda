import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, increment
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Batch, WasteRecord } from '../../types';
import { Trash2, AlertTriangle, Search, Activity, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { writeAudit } from '../../services/auditService';
import { emailWasteRecorded } from '../../services/emailService';
import { getRecipientEmails } from '../../services/notifyHelpers';

export function WastePage() {
  const { profile, currentStore } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [logs, setLogs] = useState<WasteRecord[]>([]);

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
      (s) => setMedicines(s.docs.map((d) => ({ id: d.id, ...d.data() } as Medicine)))
    );
    const u2 = onSnapshot(
      query(collection(db, 'batches'), where('storeId', '==', currentStore.id), where('isDepleted', '==', false)),
      (s) => setBatches(s.docs.map((d) => ({ id: d.id, ...d.data() } as Batch)))
    );
    const u3 = onSnapshot(
      query(collection(db, 'waste_records'), where('storeId', '==', currentStore.id)),
      (s) =>
        setLogs(
          s.docs
            .map((d) => ({ id: d.id, ...d.data() } as WasteRecord))
            .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
        )
    );
    return () => { u1(); u2(); u3(); };
  }, [currentStore]);

  const filteredMeds =
    search.length > 1
      ? medicines.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
      : [];

  const medBatches = selectedMed ? batches.filter((b) => b.medicineId === selectedMed.id) : [];

  const handleLogWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore || !profile || !selectedMed || !selectedBatchId) return;
    setIsSubmitting(true);
    try {
      const batch = batches.find((b) => b.id === selectedBatchId);
      if (!batch || batch.quantity < qty) throw new Error('Insufficient stock in batch');

      const value = qty * selectedMed.unitPrice;

      await addDoc(collection(db, 'waste_records'), {
        storeId: currentStore.id,
        medicineId: selectedMed.id,
        batchId: selectedBatchId,
        quantity: qty,
        wasteValue: value,
        reason,
        recordedAt: new Date().toISOString(),
        recordedBy: profile.uid,
      });

      await updateDoc(doc(db, 'batches', selectedBatchId), { quantity: increment(-qty) });

      await writeAudit(profile.email, currentStore.id, 'RECORD_WASTE', 'batch', selectedBatchId, {
        medicine: selectedMed.name, qty, value, reason,
      });

      // Email the manager
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* ── LOG FORM ─────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1 space-y-4">
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/5">
            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Log Stock Waste</h3>
              <p className="text-xs text-slate-400">Record expiries & damages</p>
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
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <AnimatePresence>
                {filteredMeds.length > 0 && !selectedMed && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute w-full mt-1 bg-navy-800 border border-white/10 rounded-xl max-h-48 overflow-y-auto shadow-xl z-50">
                    {filteredMeds.map((m) => (
                      <button key={m.id} type="button"
                        onClick={() => { setSelectedMed(m); setSearch(''); }}
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
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-5 overflow-hidden">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                    <span className="font-bold text-blue-400 text-sm">{selectedMed.name}</span>
                    <button type="button" onClick={() => setSelectedMed(null)} className="text-xs text-slate-500 hover:text-white uppercase font-bold">Change</button>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">2. Select Batch</label>
                    <select className="glass-input w-full py-3 text-sm" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} required>
                      <option value="">Select batch...</option>
                      {medBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batchNumber} — Qty: {b.quantity} — Exp: {new Date(b.expiryDate).toLocaleDateString('en-GB')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">3. Quantity</label>
                      <input type="number" min="1" max={batches.find((b) => b.id === selectedBatchId)?.quantity || 999}
                        className="glass-input w-full py-3 text-center font-mono font-bold"
                        value={qty} onChange={(e) => setQty(Number(e.target.value))} required />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">4. Reason</label>
                      <select className="glass-input w-full py-3 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
                        <option value="expired">Expired</option>
                        <option value="damaged">Damaged</option>
                        <option value="lost">Lost</option>
                        <option value="recalled">Recalled</option>
                      </select>
                    </div>
                  </div>

                  {selectedMed && qty > 0 && (
                    <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-xs text-red-400 font-bold">
                      Estimated loss: ₹{(qty * selectedMed.unitPrice).toLocaleString('en-IN')}
                    </div>
                  )}

                  <button type="submit" disabled={!selectedBatchId || isSubmitting}
                    className="w-full py-4 rounded-xl font-bold text-sm bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all disabled:opacity-50">
                    {isSubmitting ? 'Recording...' : 'Record Waste'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>

        <div className="glass-panel p-5 bg-amber-500/5 border border-amber-500/10">
          <h4 className="flex items-center gap-2 font-bold text-sm text-amber-500 mb-2">
            <AlertTriangle size={14} /> Manager Action — Audited
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Waste adjustments reduce stock in real-time and are permanently logged. An email notification is also sent to your registered addresses.
          </p>
        </div>
      </motion.div>

      {/* ── LOGS TABLE ───────────────────────────────── */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-blue-500" />
            <h3 className="text-xl font-bold text-white">Waste Activity Log</h3>
          </div>
          {totalWasteValue > 0 && (
            <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
              <span className="text-xs text-slate-400">Total: </span>
              <span className="text-sm font-mono font-bold text-red-400">₹{totalWasteValue.toLocaleString('en-IN')}</span>
            </div>
          )}
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
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-4">Medicine</th>
                    <th className="py-4 px-4">Batch</th>
                    <th className="py-4 px-4 text-right">Qty Lost</th>
                    <th className="py-4 px-4 text-right">₹ Impact</th>
                    <th className="py-4 px-6">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log) => {
                    const med = medicines.find((m) => m.id === log.medicineId);
                    const batch = batches.find((b) => b.id === log.batchId);
                    return (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 text-xs text-slate-400 font-mono whitespace-nowrap">
                          {new Date(log.recordedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-4 px-4 font-bold text-sm text-white">{med?.name ?? 'Unknown'}</td>
                        <td className="py-4 px-4 text-xs font-mono text-slate-500">{batch?.batchNumber ?? log.batchId.slice(0, 8)}</td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-red-400">-{log.quantity}</td>
                        <td className="py-4 px-4 text-right font-mono text-slate-300">₹{log.wasteValue.toLocaleString('en-IN')}</td>
                        <td className="py-4 px-6">
                          <span className="text-[10px] font-bold uppercase tracking-widest bg-white/5 px-2 py-1 rounded text-slate-300 border border-white/10">{log.reason}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
