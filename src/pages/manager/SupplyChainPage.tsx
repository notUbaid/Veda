import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Order, UserProfile } from '../../types';
import { Truck, PackageOpen, LayoutDashboard, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { writeAudit } from '../../services/auditService';
import { emailOrderUpdate } from '../../services/emailService';
import { getRecipientEmails } from '../../services/notifyHelpers';

const STAGES: { title: string; status: Order['status'] }[] = [
  { title: 'Pending Approval', status: 'pending' },
  { title: 'Confirmed / Processing', status: 'confirmed' },
  { title: 'Dispatched / In-Transit', status: 'dispatched' },
];

export function SupplyChainPage() {
  const { profile, currentStore } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [advancing, setAdvancing] = useState<string | null>(null);

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
          .filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
      )
    );
    return () => { u1(); u2(); };
  }, [currentStore]);

  const advanceStatus = async (order: Order) => {
    if (!profile || !currentStore || advancing) return;
    const next: Record<string, Order['status']> = {
      pending: 'confirmed', confirmed: 'dispatched', dispatched: 'delivered',
    };
    const nextStatus = next[order.status];
    if (!nextStatus) return;

    setAdvancing(order.id);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: nextStatus,
        ...(nextStatus === 'delivered' ? { deliveredAt: new Date().toISOString() } : {}),
      });

      await writeAudit(profile.email, currentStore.id, 'UPDATE_ORDER_STATUS', 'order', order.id, {
        from: order.status, to: nextStatus,
      });

      const med = medicines.find(m => m.id === order.medicineId);

      // Email the manager
      emailOrderUpdate({
        recipientName:   profile.name,
        recipientEmails: getRecipientEmails(profile),
        medicineName:    med?.name ?? order.medicineName ?? 'Unknown',
        newStatus:       nextStatus,
        quantity:        order.quantity,
        storeName:       currentStore.name,
      }).catch(console.warn);

      // On delivery, also email each pharmacist in this store
      if (nextStatus === 'delivered') {
        getDocs(
          query(collection(db, 'users'),
            where('storeId', '==', currentStore.id),
            where('role', '==', 'pharmacist'))
        ).then(snap => {
          snap.docs.forEach(d => {
            const ph = d.data() as UserProfile;
            emailOrderUpdate({
              recipientName:   ph.name,
              recipientEmails: getRecipientEmails(ph),
              medicineName:    med?.name ?? order.medicineName ?? 'Unknown',
              newStatus:       'delivered',
              quantity:        order.quantity,
              storeName:       currentStore.name,
            }).catch(console.warn);
          });
        }).catch(console.warn);
      }
    } catch (e: any) {
      alert('Failed to update status: ' + e.message);
    } finally {
      setAdvancing(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
            <Truck size={24} className="text-blue-500" /> Supply Chain Tracker
          </h2>
          <p className="text-slate-400 text-sm">
            Advance order status with the card buttons. Emails fire on every change.
          </p>
        </div>
        <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <LayoutDashboard size={14} /> Kanban View
        </div>
      </div>

      <div className="flex gap-5 overflow-x-auto pb-6 scrollbar-hide min-h-[60vh]">
        {STAGES.map(stage => {
          const stageOrders = orders.filter(o => o.status === stage.status);
          return (
            <div key={stage.status}
              className="flex-1 min-w-[300px] bg-white/5 border border-white/5 rounded-3xl p-4 flex flex-col">
              <div className="flex justify-between items-center mb-5 px-1">
                <h3 className="font-bold text-slate-300 text-sm">{stage.title}</h3>
                <span className="text-xs font-bold text-slate-500 bg-black/20 px-2 py-0.5 rounded-full">
                  {stageOrders.length}
                </span>
              </div>

              <div className="flex-1 flex flex-col gap-4 overflow-y-auto scrollbar-hide">
                {stageOrders.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-30 border-2 border-dashed border-white/5 rounded-2xl py-16">
                    <PackageOpen size={28} className="text-slate-500 mb-2" />
                    <p className="text-xs text-slate-500">No orders here</p>
                  </div>
                ) : stageOrders.map(order => {
                  const med = medicines.find(m => m.id === order.medicineId);
                  const nextLabel: Record<string, string> = {
                    pending:   'Mark Confirmed',
                    confirmed: 'Mark Dispatched',
                    dispatched:'Mark Delivered',
                  };
                  const isAdvancing = advancing === order.id;
                  return (
                    <motion.div key={order.id} layout
                      className="bg-navy-900 border border-white/10 rounded-2xl p-4 hover:border-blue-500/40 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 ${
                          order.urgency === 'critical' ? 'bg-red-500/20 text-red-400'
                          : order.urgency === 'urgent' ? 'bg-amber-500/20 text-amber-500'
                          : 'bg-white/10 text-slate-400'
                        }`}>
                          {order.urgency === 'critical' && <AlertCircle size={10} />}
                          {order.urgency}
                        </span>
                        {order.aiSuggested && (
                          <span className="text-[9px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">AI</span>
                        )}
                      </div>

                      <h4 className="font-bold text-white text-sm leading-tight mb-1">
                        {med?.name ?? order.medicineName ?? 'Unknown'}
                      </h4>
                      <div className="flex justify-between text-xs text-slate-400 font-mono mb-4 pb-3 border-b border-white/5">
                        <span>Qty: {order.quantity}</span>
                        <span className="font-bold text-emerald-400">₹{order.totalValue.toLocaleString('en-IN')}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock size={11} />
                          {formatDistanceToNow(new Date(order.orderedAt))} ago
                        </p>
                        {nextLabel[order.status] && (
                          <button
                            onClick={() => advanceStatus(order)}
                            disabled={isAdvancing}
                            className="text-[10px] font-bold text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 px-2 py-1 rounded-lg transition-all uppercase tracking-widest disabled:opacity-40"
                          >
                            {isAdvancing ? '…' : nextLabel[order.status]}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
