import React, { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, updateDoc, doc, addDoc, getDocs, where
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Order, Medicine, Store, UserProfile } from '../../types';
import { ShieldCheck, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { writeAudit } from '../../services/auditService';
import { emailApprovalResult } from '../../services/emailService';
import { getRecipientEmails } from '../../services/notifyHelpers';

export function AdminApprovalsPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'medicines'), (s) =>
      setMedicines(s.docs.map((d) => ({ id: d.id, ...d.data() } as Medicine)))
    );
    const u2 = onSnapshot(collection(db, 'stores'), (s) =>
      setStores(s.docs.map((d) => ({ id: d.id, ...d.data() } as Store)))
    );
    const u3 = onSnapshot(query(collection(db, 'orders')), (s) => {
      const data = s.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      setOrders(
        data
          .filter((o) => o.approvalStatus === 'pending')
          .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
      );
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const handleApproval = async (
    orderId: string,
    status: 'approved' | 'rejected',
    store: Store | undefined,
    med: Medicine | undefined
  ) => {
    if (!profile || !store || !med) return;
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        approvalStatus: status,
        status: status === 'rejected' ? 'cancelled' : 'pending',
        approvedBy: profile.uid,
        approvedAt: new Date().toISOString(),
      });

      const order = orders.find(o => o.id === orderId);

      await addDoc(collection(db, 'notifications'), {
        storeId: store.id,
        title: `Requisition ${status === 'approved' ? 'Approved ✓' : 'Rejected ✗'}`,
        message: `Admin ${profile.name} has ${status} your order for ${med.name}.`,
        type: 'system',
        urgency: status === 'rejected' ? 'critical' : 'info',
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      await writeAudit(
        profile.email, store.id,
        `ADMIN_APPROVAL_${status.toUpperCase()}`,
        'order', orderId,
        { medicine: med.name, status }
      );

      // Find the store manager and email them the decision
      try {
        const managerSnap = await getDocs(
          query(collection(db, 'users'), where('uid', '==', store.managerId))
        );
        if (!managerSnap.empty) {
          const managerProfile = managerSnap.docs[0].data() as UserProfile;
          emailApprovalResult({
            recipientName:   managerProfile.name,
            recipientEmails: getRecipientEmails(managerProfile),
            medicineName:    med.name,
            status,
            totalValue:      order?.totalValue ?? 0,
            storeName:       store.name,
            adminName:       profile.name,
          }).catch(console.warn);
        }
      } catch (emailErr) {
        console.warn('Manager email lookup failed:', emailErr);
      }

    } catch (e) {
      alert('Failed to process approval');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
          <ShieldCheck size={24} className="text-emerald-500" /> Pending Approvals
        </h2>
        <p className="text-slate-400 text-sm">
          Review orders flagged for admin clearance before supplier dispatch. The store manager will receive an email on your decision.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 glass-panel p-20 flex flex-col items-center justify-center text-center opacity-70">
            <ShieldCheck size={48} className="text-emerald-500/50 mb-4" />
            <p className="text-lg font-bold text-white">Inbox Zero</p>
            <p className="text-slate-400 text-sm">All requisitions have been processed.</p>
          </div>
        ) : (
          orders.map((order) => {
            const med   = medicines.find((m) => m.id === order.medicineId);
            const store = stores.find((s) => s.id === order.storeId);

            return (
              <motion.div key={order.id} layout initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="glass-panel p-6 border-l-4 border-l-amber-500">
                <div className="mb-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-amber-500 mb-1">Awaiting Clearance</p>
                  <p className="font-bold text-white text-lg">{med?.name ?? 'Unknown'}</p>
                  <p className="text-sm font-mono text-slate-400">Qty: {order.quantity}</p>
                </div>

                <div className="space-y-2 mb-6 text-sm">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-500">Destination</span>
                    <span className="font-bold text-indigo-300 text-right truncate ml-4">{store?.name ?? 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-500">Value</span>
                    <span className="font-mono text-emerald-400 font-bold">₹{order.totalValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Urgency</span>
                    <span className={`uppercase font-bold text-[10px] px-2 py-0.5 rounded border ${
                      order.urgency === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/20'
                      : order.urgency === 'urgent' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}>{order.urgency}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => handleApproval(order.id, 'rejected', store, med)}
                    className="flex-1 flex justify-center items-center gap-2 py-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all font-bold text-sm">
                    <X size={16} /> Reject
                  </button>
                  <button onClick={() => handleApproval(order.id, 'approved', store, med)}
                    className="flex-1 flex justify-center items-center gap-2 py-3 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all font-bold text-sm">
                    <Check size={16} /> Approve
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
