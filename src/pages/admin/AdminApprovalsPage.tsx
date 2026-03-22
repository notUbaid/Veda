import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, onSnapshot, updateDoc, doc, addDoc, getDocs, where, writeBatch
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Order, Medicine, Store, UserProfile } from '../../types';
import {
  ShieldCheck, Check, X, Package, Calendar, AlertCircle, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { writeAudit } from '../../services/auditService';
import { emailApprovalResult } from '../../services/emailService';
import { getRecipientEmails } from '../../services/notifyHelpers';
import { formatDistanceToNow } from 'date-fns';

/** Group orders by PO id — returns entries sorted newest first */
function groupByPO(orders: Order[]): [string, Order[]][] {
  const byPO: Record<string, Order[]> = {};
  orders.forEach(o => {
    const key = o.purchaseOrderId || o.id;
    if (!byPO[key]) byPO[key] = [];
    byPO[key].push(o);
  });
  return Object.entries(byPO).sort(([, a], [, b]) =>
    new Date(b[0].orderedAt).getTime() - new Date(a[0].orderedAt).getTime()
  );
}

export function AdminApprovalsPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [processing, setProcessing] = useState<string | null>(null); // PO id

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'medicines'), s =>
      setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine)))
    );
    const u2 = onSnapshot(collection(db, 'stores'), s =>
      setStores(s.docs.map(d => ({ id: d.id, ...d.data() } as Store)))
    );
    const u3 = onSnapshot(query(collection(db, 'orders')), s => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      setOrders(
        data.filter(o => o.approvalStatus === 'pending')
            .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
      );
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  // Group pending orders by PO
  const pendingPOs = useMemo(() => groupByPO(orders), [orders]);

  const handleApproval = async (
    poId: string,
    poOrders: Order[],
    status: 'approved' | 'rejected'
  ) => {
    if (!profile || processing) return;
    setProcessing(poId);
    try {
      const now = new Date().toISOString();
      const store = stores.find(s => s.id === poOrders[0].storeId);
      const totalValue = poOrders.reduce((s, o) => s + o.totalValue, 0);

      // Update ALL order docs in this PO atomically (batch write)
      const batch = writeBatch(db);
      poOrders.forEach(order => {
        batch.update(doc(db, 'orders', order.id), {
          approvalStatus: status,
          status: status === 'rejected' ? 'cancelled' : 'pending',
          approvedBy:  profile.uid,
          approvedAt:  now,
        });
      });
      await batch.commit();

      // Notification to the store
      if (store) {
        const medNames = poOrders.map(o => o.medicineName ?? medicines.find(m => m.id === o.medicineId)?.name ?? 'Unknown').join(', ');
        await addDoc(collection(db, 'notifications'), {
          storeId:   store.id,
          title:     `PO ${status === 'approved' ? 'Approved ✓' : 'Rejected ✗'} — ${poId}`,
          message:   `Admin ${profile.name} has ${status} purchase order ${poId} (${poOrders.length} medicines: ${medNames}).`,
          type:      'system',
          urgency:   status === 'rejected' ? 'critical' : 'info',
          isRead:    false,
          createdAt: now,
        });
      }

      // Audit
      await writeAudit(profile.email, store?.id ?? 'global',
        `ADMIN_PO_${status.toUpperCase()}`, 'order', poId,
        { poId, lines: poOrders.length, totalValue, status }
      );

      // Email the store manager
      if (store) {
        try {
          const managerSnap = await getDocs(
            query(collection(db, 'users'), where('uid', '==', store.managerId))
          );
          if (!managerSnap.empty) {
            const managerProfile = managerSnap.docs[0].data() as UserProfile;
            const firstMed = poOrders[0];
            const displayName = poOrders.length === 1
              ? (firstMed.medicineName ?? medicines.find(m => m.id === firstMed.medicineId)?.name ?? 'Unknown')
              : `${poOrders.length} medicines (${poId})`;

            emailApprovalResult({
              recipientName:   managerProfile.name,
              recipientEmails: getRecipientEmails(managerProfile),
              medicineName:    displayName,
              status,
              totalValue,
              storeName:       store.name,
              adminName:       profile.name,
            }).catch(console.warn);
          }
        } catch (emailErr) {
          console.warn('Manager email lookup failed:', emailErr);
        }
      }
    } catch (e: any) {
      alert('Failed to process approval: ' + e.message);
    } finally {
      setProcessing(null);
    }
  };

  const urgencyBadge = (u: string) =>
    u === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/20'
    : u === 'urgent'  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    : 'bg-slate-500/10 text-slate-400 border-slate-500/20';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
          <ShieldCheck size={24} className="text-emerald-500" /> Pending Approvals
        </h2>
        <p className="text-slate-400 text-sm">
          Purchase Orders over ₹50,000 require admin clearance. Approve or reject the entire PO — all medicine lines are updated together.
          The store manager receives an email on your decision.
        </p>
      </div>

      {pendingPOs.length === 0 ? (
        <div className="glass-panel p-20 flex flex-col items-center justify-center text-center opacity-70">
          <ShieldCheck size={48} className="text-emerald-500/50 mb-4" />
          <p className="text-lg font-bold text-white">Inbox Zero</p>
          <p className="text-slate-400 text-sm">All requisitions have been processed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {pendingPOs.map(([poId, poOrders]) => {
            const store      = stores.find(s => s.id === poOrders[0].storeId);
            const totalValue = poOrders.reduce((s, o) => s + o.totalValue, 0);
            const mainUrgency =
              poOrders.some(o => o.urgency === 'critical') ? 'critical' :
              poOrders.some(o => o.urgency === 'urgent')   ? 'urgent'   : 'routine';
            const isProcessing = processing === poId;

            return (
              <motion.div key={poId} layout
                initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="glass-panel p-6 border-l-4 border-l-amber-500">

                {/* PO header */}
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-[9px] font-mono text-slate-600">{poId}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${urgencyBadge(mainUrgency)}`}>
                      {mainUrgency}
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-500 uppercase font-bold tracking-widest mb-1">Awaiting Clearance</p>

                  {/* Store */}
                  {store && (
                    <div className="flex items-center gap-2 text-xs text-indigo-300 mb-3">
                      <Building2 size={12} />
                      <span className="font-bold">{store.name}</span>
                      <span className="text-slate-600">· {store.location}</span>
                    </div>
                  )}

                  {/* Medicine lines */}
                  <div className="space-y-1.5 mb-3 p-3 bg-white/5 rounded-xl">
                    {poOrders.slice(0, 4).map(o => {
                      const med = medicines.find(m => m.id === o.medicineId);
                      return (
                        <div key={o.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Package size={11} className="text-slate-500 shrink-0" />
                            <span className="text-slate-300 truncate max-w-[150px]">
                              {o.medicineName ?? med?.name ?? 'Unknown'}
                            </span>
                          </div>
                          <span className="font-mono text-slate-400 shrink-0 ml-2">
                            ×{o.quantity} · ₹{o.totalValue.toLocaleString('en-IN')}
                          </span>
                        </div>
                      );
                    })}
                    {poOrders.length > 4 && (
                      <p className="text-[10px] text-slate-600 text-right">+{poOrders.length - 4} more</p>
                    )}
                  </div>
                </div>

                {/* Value + time */}
                <div className="space-y-2 mb-5 text-sm border-t border-white/5 pt-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lines</span>
                    <span className="font-bold text-white">{poOrders.length} medicines</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Value</span>
                    <span className="font-mono text-emerald-400 font-bold">₹{totalValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ordered</span>
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <Calendar size={11} />
                      {formatDistanceToNow(new Date(poOrders[0].orderedAt))} ago
                    </span>
                  </div>
                  {totalValue > 50000 && (
                    <div className="flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      <AlertCircle size={11} /> Value exceeds ₹50,000 — requires clearance
                    </div>
                  )}
                </div>

                {/* Approve / Reject buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApproval(poId, poOrders, 'rejected')}
                    disabled={isProcessing}
                    className="flex-1 flex justify-center items-center gap-2 py-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all font-bold text-sm disabled:opacity-40"
                  >
                    <X size={16} /> Reject
                  </button>
                  <button
                    onClick={() => handleApproval(poId, poOrders, 'approved')}
                    disabled={isProcessing}
                    className="flex-1 flex justify-center items-center gap-2 py-3 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all font-bold text-sm disabled:opacity-40"
                  >
                    <Check size={16} /> {isProcessing ? 'Processing...' : 'Approve'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
