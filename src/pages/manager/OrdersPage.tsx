import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Order } from '../../types';
import {
  ShoppingCart, Search, Calendar, Package,
  ChevronDown, CheckCircle2, AlertCircle, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { writeAudit } from '../../services/auditService';
import { emailOrderPlaced } from '../../services/emailService';
import { getRecipientEmails } from '../../services/notifyHelpers';

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: 'text-amber-400'   },
  confirmed:  { label: 'Confirmed',  color: 'text-blue-400'    },
  dispatched: { label: 'Dispatched', color: 'text-indigo-400'  },
  delivered:  { label: 'Delivered',  color: 'text-emerald-400' },
  cancelled:  { label: 'Cancelled',  color: 'text-red-400'     },
};

export function OrdersPage() {
  const { profile, currentStore } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [isOrdering, setIsOrdering] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  const [qty, setQty] = useState(0);
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'critical'>('routine');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    const u1 = onSnapshot(
      query(collection(db, 'medicines'), where('storeId', '==', currentStore.id)),
      s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine)))
    );
    const u2 = onSnapshot(
      query(collection(db, 'orders'), where('storeId', '==', currentStore.id)),
      s => setOrders(
        s.docs.map(d => ({ id: d.id, ...d.data() } as Order))
          .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
      )
    );
    return () => { u1(); u2(); };
  }, [currentStore]);

  const filteredMeds = search.length > 1
    ? medicines.filter(m => m.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore || !profile || !selectedMed || qty <= 0) return;
    setIsOrdering(true);
    try {
      const totalValue = qty * selectedMed.unitPrice;
      await addDoc(collection(db, 'orders'), {
        storeId: currentStore.id,
        medicineId: selectedMed.id,
        medicineName: selectedMed.name,
        quantity: qty,
        unitPrice: selectedMed.unitPrice,
        totalValue,
        supplier: selectedMed.supplier,
        status: 'pending',
        urgency,
        aiSuggested: false,
        orderedAt: new Date().toISOString(),
        approvalStatus: totalValue > 50000 ? 'pending' : 'auto',
        type: 'requisition',
      });
      await writeAudit(profile.email, currentStore.id, 'CREATE_ORDER', 'order', undefined, {
        medicine: selectedMed.name, qty, value: totalValue, urgency,
      });
      // Email confirmation to manager
      emailOrderPlaced({
        recipientName:   profile.name,
        recipientEmails: getRecipientEmails(profile),
        medicineName:    selectedMed.name,
        quantity:        qty,
        unitPrice:       selectedMed.unitPrice,
        totalValue,
        urgency:         urgency,
        supplier:        selectedMed.supplier,
        storeName:       currentStore.name,
        needsApproval:   totalValue > 50000,
      }).catch(console.warn);
      setOrderSuccess(true);
      setSelectedMed(null);
      setQty(0);
      setSearch('');
      setUrgency('routine');
      setTimeout(() => setOrderSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsOrdering(false);
    }
  };

  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const historyOrders = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT: Requisition form */}
        <div className="lg:col-span-2">
          <div className="glass-panel p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShoppingCart size={18} className="text-blue-500" /> Place Requisition
              </h2>
              <p className="text-xs text-slate-400 mt-1">Request stock replenishment from supplier.</p>
            </div>

            <AnimatePresence>
              {orderSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-bold"
                >
                  <CheckCircle2 size={15} /> Requisition placed! Email sent.
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handlePlaceOrder} className="space-y-4">
              <div className="relative z-20">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                  1. Select Medicine
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input
                    type="text"
                    className="glass-input w-full pl-9 py-2.5 text-sm"
                    placeholder="Type medicine name..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <AnimatePresence>
                  {filteredMeds.length > 0 && !selectedMed && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute left-0 right-0 mt-1 bg-navy-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                      {filteredMeds.map(m => (
                        <button
                          key={m.id} type="button"
                          onClick={() => { setSelectedMed(m); setSearch(''); setQty(m.reorderThreshold); }}
                          className="flex items-center justify-between w-full px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                        >
                          <span className="text-sm font-bold text-white">{m.name}</span>
                          <span className="text-xs text-emerald-400 font-mono">₹{m.unitPrice}/{m.unit}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {selectedMed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-blue-400">{selectedMed.name}</p>
                      <p className="text-[10px] text-slate-500">₹{selectedMed.unitPrice}/{selectedMed.unit}</p>
                    </div>
                    <button type="button"
                      onClick={() => { setSelectedMed(null); setQty(0); }}
                      className="text-xs text-slate-500 hover:text-white font-bold uppercase">
                      Change
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">2. Quantity</label>
                      <input type="number" min="1"
                        className="glass-input w-full py-2.5 text-center font-mono font-bold text-emerald-400"
                        value={qty} onChange={e => setQty(Number(e.target.value))} required />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Total Value</label>
                      <div className="glass-input w-full py-2.5 text-center font-mono text-slate-300 select-none">
                        ₹{(qty * selectedMed.unitPrice).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">3. Urgency</label>
                    <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
                      {(['routine', 'urgent', 'critical'] as const).map(u => (
                        <button key={u} type="button" onClick={() => setUrgency(u)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                            urgency === u
                              ? u === 'critical' ? 'bg-red-500/20 text-red-400'
                                : u === 'urgent' ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-white/15 text-white'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}>
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  {qty * selectedMed.unitPrice > 50000 && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                      <AlertCircle size={13} /> Over ₹50,000 — admin approval required.
                    </div>
                  )}

                  <button type="submit" disabled={isOrdering || qty <= 0}
                    className="w-full glass-button-primary py-3 text-sm">
                    {isOrdering ? 'Submitting...' : 'Issue Procurement Request'}
                  </button>
                </motion.div>
              )}
            </form>
          </div>
        </div>

        {/* RIGHT: Active + History */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-white">Active Orders</h3>
            {activeOrders.length > 0 && (
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                {activeOrders.length}
              </span>
            )}
          </div>

          {activeOrders.length === 0 ? (
            <div className="glass-panel p-10 flex flex-col items-center text-center opacity-50">
              <Package size={32} className="text-slate-500 mb-3" />
              <p className="font-bold text-white text-sm">No active orders</p>
              <p className="text-xs text-slate-500 mt-1">Place a requisition on the left.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeOrders.map(order => {
                const med = medicines.find(m => m.id === order.medicineId);
                const meta = STATUS_META[order.status] ?? STATUS_META.pending;
                return (
                  <div key={order.id} className="glass-panel p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-white truncate">
                        {med?.name ?? (order as any).medicineName ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Qty: {order.quantity} · ₹{order.totalValue.toLocaleString('en-IN')}
                        {order.approvalStatus === 'pending' && (
                          <span className="text-amber-500 ml-2">· Awaiting approval</span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-1 flex items-center gap-1 font-mono">
                        <Calendar size={9} />
                        {new Date(order.orderedAt).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        order.urgency === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : order.urgency === 'urgent' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>{order.urgency}</span>
                      <span className={`text-xs font-bold uppercase ${meta.color}`}>{meta.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* History accordion */}
          <div className="glass-panel overflow-hidden">
            <button
              onClick={() => setHistoryOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <History size={15} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-300">Order History</span>
                <span className="text-[10px] text-slate-500 bg-white/5 border border-white/5 px-2 py-0.5 rounded-full">
                  {historyOrders.length}
                </span>
              </div>
              <ChevronDown size={15} className={`text-slate-500 transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {historyOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-white/5"
                >
                  {historyOrders.length === 0 ? (
                    <p className="text-center text-slate-500 text-sm py-8">No completed orders yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/5">
                            <th className="py-3 px-5">Date</th>
                            <th className="py-3 px-4">Medicine</th>
                            <th className="py-3 px-4 text-center">Urgency</th>
                            <th className="py-3 px-4 text-right">Value</th>
                            <th className="py-3 px-5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {historyOrders.map(order => {
                            const med = medicines.find(m => m.id === order.medicineId);
                            const meta = STATUS_META[order.status] ?? STATUS_META.delivered;
                            return (
                              <tr key={order.id} className="hover:bg-white/5 transition-colors opacity-60 hover:opacity-100">
                                <td className="py-3 px-5 text-xs text-slate-500 font-mono whitespace-nowrap">
                                  {new Date(order.orderedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                </td>
                                <td className="py-3 px-4">
                                  <p className="text-sm font-bold text-white">{med?.name ?? 'Unknown'}</p>
                                  <p className="text-xs text-slate-600 font-mono">Qty: {order.quantity}</p>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                    order.urgency === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : order.urgency === 'urgent' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                  }`}>{order.urgency}</span>
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-slate-400 text-sm">
                                  ₹{order.totalValue.toLocaleString('en-IN')}
                                </td>
                                <td className="py-3 px-5 text-right">
                                  <span className={`text-[10px] font-bold uppercase ${meta.color}`}>{meta.label}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
