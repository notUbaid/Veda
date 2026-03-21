import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, increment, getDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Batch } from '../../types';
import {
  Search, Plus, Minus, CheckCircle2, Package,
  MapPin, X, AlertTriangle, FileText, Pill,
  ShoppingBag, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInDays } from 'date-fns';
import { writeAudit } from '../../services/auditService';
import { generateDispenseBill } from '../../services/pdfService';
import { emailDispenseConfirm } from '../../services/emailService';
import { getRecipientEmails } from '../../services/notifyHelpers';

function sortFEFO(batches: Batch[]): Batch[] {
  return [...batches]
    .filter(b => !b.isDepleted && !b.isDisposed && b.quantity > 0 && new Date(b.expiryDate) > new Date())
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
}

interface BillItem {
  id: string;
  medicineId: string;
  medicineName: string;
  genericName: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  fefoAssignedBatches: { batchId: string; batchNumber: string; quantity: number; location: string }[];
  lineTotal: number;
}

function simulateFEFO(
  medicineId: string,
  requestedQty: number,
  allBatches: Batch[],
  existingBillItems: BillItem[]
): { assigned: { batchId: string; batchNumber: string; quantity: number; location: string }[]; remaining: number } {
  const fefo = sortFEFO(allBatches.filter(b => b.medicineId === medicineId));
  let remaining = requestedQty;
  const assigned: { batchId: string; batchNumber: string; quantity: number; location: string }[] = [];
  for (const batch of fefo) {
    if (remaining <= 0) break;
    const reserved = existingBillItems.reduce((sum, item) => {
      const match = item.fefoAssignedBatches.find(b => b.batchId === batch.id);
      return sum + (match ? match.quantity : 0);
    }, 0);
    const available = batch.quantity - reserved;
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    const loc = batch.location
      ? `${batch.location.aisle}/${batch.location.row}/${batch.location.shelf}/${batch.location.compartment}`
      : 'N/A';
    assigned.push({ batchId: batch.id, batchNumber: batch.batchNumber, quantity: take, location: loc });
    remaining -= take;
  }
  return { assigned, remaining };
}

export function DispensePage() {
  const { profile, currentStore } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  const [qty, setQty] = useState(1);

  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [patientRef, setPatientRef] = useState('');
  const [dispensing, setDispensing] = useState(false);
  const [dispensed, setDispensed] = useState(false);
  const [lastBillId, setLastBillId] = useState('');
  const [billId] = useState(`BILL-${Date.now().toString(36).toUpperCase()}`);

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

  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return medicines.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.genericName || '').toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery, medicines]);

  const fefoSim = useMemo(() => {
    if (!selectedMed) return null;
    return simulateFEFO(selectedMed.id, qty, batches, billItems);
  }, [selectedMed, qty, batches, billItems]);

  const selectedMedTotalStock = useMemo(() => {
    if (!selectedMed) return 0;
    return sortFEFO(batches.filter(b => b.medicineId === selectedMed.id)).reduce((s, b) => s + b.quantity, 0);
  }, [selectedMed, batches]);

  const handleSelectMed = (med: Medicine) => {
    setSelectedMed(med);
    setSearchQuery('');
    setShowDropdown(false);
    setQty(1);
  };

  const handleAddToBill = () => {
    if (!selectedMed || !fefoSim) return;
    if (fefoSim.remaining > 0) {
      alert(`Only ${qty - fefoSim.remaining} ${selectedMed.unit} available.`);
      return;
    }
    const existingIdx = billItems.findIndex(i => i.medicineId === selectedMed.id);
    if (existingIdx >= 0) {
      const combinedQty = billItems[existingIdx].quantity + qty;
      const combinedSim = simulateFEFO(selectedMed.id, combinedQty, batches, billItems.filter((_, i) => i !== existingIdx));
      if (combinedSim.remaining > 0) { alert(`Insufficient stock for ${combinedQty} ${selectedMed.unit}.`); return; }
      setBillItems(prev => prev.map((item, i) =>
        i === existingIdx
          ? { ...item, quantity: combinedQty, fefoAssignedBatches: combinedSim.assigned, lineTotal: combinedQty * selectedMed.unitPrice }
          : item
      ));
    } else {
      setBillItems(prev => [...prev, {
        id: Date.now().toString(),
        medicineId: selectedMed.id,
        medicineName: selectedMed.name,
        genericName: selectedMed.genericName || '',
        unitPrice: selectedMed.unitPrice,
        unit: selectedMed.unit,
        quantity: qty,
        fefoAssignedBatches: fefoSim.assigned,
        lineTotal: qty * selectedMed.unitPrice,
      }]);
    }
    setSelectedMed(null);
    setQty(1);
  };

  const handleConfirmDispense = async () => {
    if (billItems.length === 0 || !currentStore || !profile || dispensing) return;
    setDispensing(true);
    try {
      for (const item of billItems) {
        for (const b of item.fefoAssignedBatches) {
          const snap = await getDoc(doc(db, 'batches', b.batchId));
          if (!snap.exists()) throw new Error(`Batch ${b.batchNumber} no longer exists.`);
          if ((snap.data().quantity as number) < b.quantity)
            throw new Error(`Stock changed for ${item.medicineName}. Please rebuild the bill.`);
        }
      }
      for (const item of billItems) {
        for (const b of item.fefoAssignedBatches) {
          const bRef = doc(db, 'batches', b.batchId);
          const snap = await getDoc(bRef);
          const newQty = (snap.data()?.quantity ?? 0) - b.quantity;
          await updateDoc(bRef, { quantity: increment(-b.quantity), isDepleted: newQty <= 0 });
        }
        await addDoc(collection(db, 'dispense_logs'), {
          medicineId: item.medicineId, medicineName: item.medicineName,
          storeId: currentStore.id, pharmacistId: profile.uid, pharmacistName: profile.name,
          quantity: item.quantity, unitPrice: item.unitPrice, totalValue: item.lineTotal,
          patientRef, batchesUsed: item.fefoAssignedBatches,
          fefoCompliant: true, billId, timestamp: new Date().toISOString(),
        });
        await writeAudit(profile.email, currentStore.id, 'DISPENSE', 'medicine', item.medicineId, {
          medicine: item.medicineName, qty: item.quantity, value: item.lineTotal, bill: billId, patient: patientRef || 'N/A',
        });
        const med = medicines.find(m => m.id === item.medicineId);
        if (med) {
          const remaining = sortFEFO(batches.filter(b => b.medicineId === med.id)).reduce((s, b) => s + b.quantity, 0) - item.quantity;
          if (remaining < med.reorderThreshold) {
            await addDoc(collection(db, 'notifications'), {
              storeId: currentStore.id, type: 'low_stock',
              title: `Low Stock: ${med.name}`,
              message: `Stock ~${Math.max(0, remaining)} ${med.unit}. Threshold: ${med.reorderThreshold}.`,
              urgency: remaining <= 0 ? 'critical' : 'warning',
              isRead: false, createdAt: new Date().toISOString(), medicineId: med.id,
            });
          }
        }
      }
      generateDispenseBill(billId, currentStore, profile,
        billItems.map(item => ({
          medicineName: item.medicineName, quantity: item.quantity, unit: item.unit,
          unitPrice: item.unitPrice, lineTotal: item.lineTotal,
          batchNumbers: item.fefoAssignedBatches.map(b => b.batchNumber).join(', '),
        })),
        patientRef || 'N/A'
      );
      // Email receipt to pharmacist (primary + alternate emails)
      emailDispenseConfirm({
        recipientName:   profile.name,
        recipientEmails: getRecipientEmails(profile),
        billId,
        items: billItems.map(i => ({ name: i.medicineName, qty: i.quantity, unit: i.unit, value: i.lineTotal })),
        totalValue: totalBillValue,
        patientRef: patientRef || 'N/A',
        storeName: currentStore.name,
      }).catch(console.warn);
      setLastBillId(billId);
      setDispensed(true);
      setBillItems([]);
      setPatientRef('');
    } catch (e: any) {
      alert('Dispense failed: ' + (e.message || e));
    } finally {
      setDispensing(false);
    }
  };

  const totalBillValue = billItems.reduce((s, i) => s + i.lineTotal, 0);

  if (dispensed) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto mt-16 rounded-3xl p-10 text-center"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Dispensed Successfully</h2>
        <p className="text-slate-400 text-sm mb-1">Invoice PDF downloaded. Email receipt sent.</p>
        <p className="text-[10px] font-mono text-slate-600 mb-7">{lastBillId}</p>
        <button onClick={() => setDispensed(false)} className="glass-button-primary px-8 py-2.5 mx-auto">
          New Bill
        </button>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">

      {/* LEFT: Search + item builder */}
      <div className="xl:col-span-3 space-y-4">

        {/* Search panel */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
            <Pill size={15} className="text-blue-400" /> Add Medicine to Bill
          </h3>
          <div className="relative z-20">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              type="text"
              placeholder="Search by name, generic, or category..."
              className="glass-input w-full pl-9 py-2.5 text-sm"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
            />
            <AnimatePresence>
              {showDropdown && searchQuery.length > 1 && !selectedMed && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  className="absolute left-0 right-0 top-full mt-1 rounded-2xl overflow-hidden shadow-2xl z-50"
                  style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {searchResults.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-5">No medicines match</p>
                  ) : searchResults.map(m => {
                    const stock = sortFEFO(batches.filter(b => b.medicineId === m.id)).reduce((s, b) => s + b.quantity, 0);
                    const isLow = stock < m.reorderThreshold;
                    return (
                      <button key={m.id} onClick={() => handleSelectMed(m)}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="font-bold text-sm text-white">{m.name}</p>
                          <p className="text-xs text-slate-500">{m.genericName} · {m.category}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono font-bold text-emerald-400">₹{m.unitPrice}</p>
                          <p className={`text-[10px] font-bold ${isLow ? 'text-red-400' : 'text-slate-500'}`}>
                            {stock} {m.unit}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Selected medicine form */}
        <AnimatePresence>
          {selectedMed && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="rounded-2xl p-4"
              style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Selected</p>
                  <h4 className="font-bold text-lg text-white leading-tight">{selectedMed.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedMed.genericName} · <span className="text-emerald-400 font-bold">₹{selectedMed.unitPrice}</span>/{selectedMed.unit}
                    <span className={`ml-3 font-bold ${selectedMedTotalStock < selectedMed.reorderThreshold ? 'text-amber-400' : 'text-slate-400'}`}>
                      ({selectedMedTotalStock} available)
                    </span>
                  </p>
                </div>
                <button onClick={() => setSelectedMed(null)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors">
                  <X size={15} />
                </button>
              </div>

              {/* Qty */}
              <div className="mb-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Quantity ({selectedMed.unit})</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <Minus size={15} />
                  </button>
                  <input type="number" min={1} value={qty}
                    onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 glass-input text-center font-mono font-bold text-lg py-1.5" />
                  <button onClick={() => setQty(qty + 1)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              {/* FEFO */}
              {fefoSim && (
                <div className="mb-4">
                  {fefoSim.assigned.length === 0 || fefoSim.remaining > 0 ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl text-red-400 text-sm"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <AlertTriangle size={15} />
                      <span className="font-bold">
                        {fefoSim.assigned.length === 0 ? 'No stock available' : `Only ${qty - fefoSim.remaining} of ${qty} available`}
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">FEFO Batches</span>
                        <div className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 size={11} /><span className="text-[10px] font-bold">Compliant</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {fefoSim.assigned.map((b, i) => {
                          const batchData = batches.find(x => x.id === b.batchId);
                          const daysLeft = batchData ? differenceInDays(new Date(batchData.expiryDate), new Date()) : null;
                          return (
                            <div key={b.batchId}
                              className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg ${i === 0 ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/5'}`}>
                              <div className="flex items-center gap-2">
                                {i === 0 && <span className="text-[9px] font-bold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded uppercase">FIRST</span>}
                                <span className="font-mono font-bold text-white">{b.batchNumber}</span>
                                {b.location !== 'N/A' && (
                                  <span className="text-slate-500 flex items-center gap-0.5 text-[10px]">
                                    <MapPin size={9} />{b.location}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {daysLeft !== null && (
                                  <span className={`text-[10px] font-bold ${daysLeft <= 7 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-slate-500'}`}>
                                    {daysLeft}d
                                  </span>
                                )}
                                <span className="font-mono font-bold text-white text-xs">{b.quantity}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Line Total</p>
                  <p className="text-lg font-mono font-bold text-white">₹{(qty * selectedMed.unitPrice).toLocaleString('en-IN')}</p>
                </div>
                <button onClick={handleAddToBill}
                  disabled={!fefoSim || fefoSim.remaining > 0 || fefoSim.assigned.length === 0}
                  className="glass-button-primary px-6 py-2.5 text-sm disabled:opacity-40">
                  + Add to Bill
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile bill */}
        <div className="xl:hidden">
          <BillPanel billId={billId} billItems={billItems} patientRef={patientRef}
            setPatientRef={setPatientRef} totalBillValue={totalBillValue} dispensing={dispensing}
            onRemoveItem={id => setBillItems(prev => prev.filter(i => i.id !== id))}
            onClear={() => setBillItems([])} onConfirm={handleConfirmDispense} />
        </div>
      </div>

      {/* RIGHT: Bill (desktop) */}
      <div className="xl:col-span-2 hidden xl:block">
        <BillPanel billId={billId} billItems={billItems} patientRef={patientRef}
          setPatientRef={setPatientRef} totalBillValue={totalBillValue} dispensing={dispensing}
          onRemoveItem={id => setBillItems(prev => prev.filter(i => i.id !== id))}
          onClear={() => setBillItems([])} onConfirm={handleConfirmDispense} />
      </div>
    </div>
  );
}

interface BillPanelProps {
  billId: string; billItems: BillItem[]; patientRef: string;
  setPatientRef: (v: string) => void; totalBillValue: number;
  dispensing: boolean; onRemoveItem: (id: string) => void;
  onClear: () => void; onConfirm: () => void;
}

function BillPanel({ billId, billItems, patientRef, setPatientRef, totalBillValue, dispensing, onRemoveItem, onClear, onConfirm }: BillPanelProps) {
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', minHeight: '460px' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <ShoppingBag size={14} className="text-blue-400" />
          <span className="font-bold text-sm text-white">Dispense Bill</span>
          <span className="text-[9px] font-mono text-slate-600">{billId}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <CheckCircle2 size={10} className="text-emerald-400" />
          <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">FEFO</span>
        </div>
      </div>

      {/* Patient ref */}
      <div className="px-4 pt-3 pb-2">
        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
          Patient / Rx Reference
        </label>
        <input type="text"
          className="glass-input w-full py-2 text-sm"
          placeholder="OPD-12345 or name"
          value={patientRef}
          onChange={e => setPatientRef(e.target.value)}
        />
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 scrollbar-hide">
        {billItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-8">
            <Package size={28} className="text-slate-500 mb-2" />
            <p className="text-slate-400 text-sm font-bold">Empty</p>
            <p className="text-xs text-slate-600 mt-0.5">Add medicines on the left</p>
          </div>
        ) : billItems.map(item => (
          <div key={item.id}
            className="px-3 py-2.5 rounded-xl group relative"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={() => onRemoveItem(item.id)}
              className="absolute top-2 right-2 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
              <X size={13} />
            </button>
            <div className="flex items-start justify-between pr-5">
              <p className="font-bold text-sm text-white truncate">{item.medicineName}</p>
              <p className="font-mono font-bold text-emerald-400 text-sm shrink-0 ml-2">₹{item.lineTotal.toLocaleString('en-IN')}</p>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              {item.quantity} {item.unit} × ₹{item.unitPrice} · {item.fefoAssignedBatches.map(b => b.batchNumber).join(', ')}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest">{billItems.length} item{billItems.length !== 1 ? 's' : ''}</p>
            <p className="text-xl font-mono font-bold text-white">₹{totalBillValue.toLocaleString('en-IN')}</p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
            <FileText size={11} /> PDF + email on confirm
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClear} disabled={billItems.length === 0}
            className="px-3 py-2.5 rounded-xl font-bold text-sm text-slate-400 hover:text-red-400 transition-colors disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
            Clear
          </button>
          <button onClick={onConfirm} disabled={billItems.length === 0 || dispensing}
            className="flex-1 glass-button-primary py-2.5 text-sm font-bold disabled:opacity-40">
            {dispensing
              ? <span className="flex items-center justify-center gap-2"><RefreshCw size={13} className="animate-spin" /> Processing...</span>
              : 'Confirm & Dispense'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
