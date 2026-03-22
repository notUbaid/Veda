import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, addDoc, getDocs
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Order, Store, UserProfile } from '../../types';
import {
  Truck, PackageOpen, Clock, AlertCircle,
  CheckCircle2, Package, Building2, RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { writeAudit } from '../../services/auditService';
import { emailOrderUpdate } from '../../services/emailService';
import { getRecipientEmails } from '../../services/notifyHelpers';

const STAGES: { title: string; status: Order['status']; desc: string }[] = [
  { title: 'Pending',    status: 'pending',    desc: 'Awaiting confirmation' },
  { title: 'Confirmed',  status: 'confirmed',  desc: 'Processing at supplier' },
  { title: 'Dispatched', status: 'dispatched', desc: 'In transit to pharmacy' },
];

function groupByPO(orders: Order[]): [string, Order[]][] {
  const byPO: Record<string, Order[]> = {};
  orders.forEach(o => {
    const key = o.purchaseOrderId || o.id;
    if (!byPO[key]) byPO[key] = [];
    byPO[key].push(o);
  });
  return Object.entries(byPO).sort(
    ([, a], [, b]) => new Date(b[0].orderedAt).getTime() - new Date(a[0].orderedAt).getTime()
  );
}

export function SupplyChainPage() {
  const { profile, currentStore, stores, setCurrentStore } = useAuth();
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

  const advancePO = async (poId: string, poOrders: Order[]) => {
    if (!profile || !currentStore || advancing) return;

    const currentStatus = poOrders[0].status;
    const next: Record<string, Order['status']> = {
      pending: 'confirmed', confirmed: 'dispatched', dispatched: 'delivered',
    };
    const nextStatus = next[currentStatus];
    if (!nextStatus) return;

    setAdvancing(poId);
    try {
      const now = new Date().toISOString();

      if (nextStatus === 'delivered') {
        // ── On delivery: create Batch docs to add real inventory ──────
        for (const order of poOrders) {
          const batchNum = `${poId}-${order.medicineId.slice(-4).toUpperCase()}`;
          const defaultExpiry = new Date();
          defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 2);

          // Create the batch — this is what appears in Stock View
          await addDoc(collection(db, 'batches'), {
            medicineId:           order.medicineId,
            storeId:              order.storeId,
            batchNumber:          batchNum,
            quantity:             order.quantity,
            originalQuantity:     order.quantity,
            expiryDate:           defaultExpiry.toISOString().split('T')[0],
            purchasePrice:        order.unitPrice,
            location: { aisle: 'A', row: '1', shelf: '1', compartment: '1' },
            receivedAt:           now,
            isDepleted:           false,
            isDisposed:           false,
            sourcePurchaseOrderId: poId,
            sourceOrderId:        order.id,
          });

          // Mark order as delivered
          await updateDoc(doc(db, 'orders', order.id), {
            status:         'delivered',
            deliveredAt:    now,
            inventoryAdded: true,
          });

          await writeAudit(
            profile.email, order.storeId,
            'DELIVER_AND_ADD_INVENTORY', 'order', order.id,
            { medicine: order.medicineName ?? order.medicineId, qty: order.quantity, batch: batchNum, poId }
          );
        }

        // Store notification
        await addDoc(collection(db, 'notifications'), {
          storeId:   currentStore.id,
          type:      'order_delivered',
          title:     `Stock Delivered — ${poId}`,
          message:   `${poOrders.length} medicine${poOrders.length !== 1 ? 's' : ''} received and added to inventory. Edit expiry/location in Stock View.`,
          urgency:   'info',
          isRead:    false,
          createdAt: now,
        });

        // Emails
        const totalQty = poOrders.reduce((s, o) => s + o.quantity, 0);
        const displayName = poOrders.length === 1
          ? (poOrders[0].medicineName ?? 'Unknown')
          : `${poOrders.length} medicines (${poId})`;

        emailOrderUpdate({
          recipientName:   profile.name,
          recipientEmails: getRecipientEmails(profile),
          medicineName:    displayName,
          newStatus:       'delivered',
          quantity:        totalQty,
          storeName:       currentStore.name,
        }).catch(console.warn);

        getDocs(query(
          collection(db, 'users'),
          where('storeId', '==', currentStore.id),
          where('role', '==', 'pharmacist')
        )).then(snap => {
          snap.docs.forEach(d => {
            const ph = d.data() as UserProfile;
            emailOrderUpdate({
              recipientName:   ph.name,
              recipientEmails: getRecipientEmails(ph),
              medicineName:    displayName,
              newStatus:       'delivered',
              quantity:        totalQty,
              storeName:       currentStore.name,
            }).catch(console.warn);
          });
        }).catch(console.warn);

      } else {
        // Non-delivery advance
        for (const order of poOrders) {
          await updateDoc(doc(db, 'orders', order.id), { status: nextStatus });
          await writeAudit(
            profile.email, order.storeId,
            `ORDER_${nextStatus.toUpperCase()}`, 'order', order.id,
            { from: currentStatus, to: nextStatus, poId }
          );
        }

        const totalQty   = poOrders.reduce((s, o) => s + o.quantity, 0);
        const displayName = poOrders.length === 1
          ? (medicines.find(m => m.id === poOrders[0].medicineId)?.name ?? poOrders[0].medicineName ?? 'Unknown')
          : `${poOrders.length} medicines`;

        emailOrderUpdate({
          recipientName:   profile.name,
          recipientEmails: getRecipientEmails(profile),
          medicineName:    displayName,
          newStatus:       nextStatus,
          quantity:        totalQty,
          storeName:       currentStore.name,
        }).catch(console.warn);
      }
    } catch (e: any) {
      alert('Failed: ' + e.message);
    } finally {
      setAdvancing(null);
    }
  };

  const stageGroups = STAGES.map(stage => ({
    ...stage,
    poGroups: groupByPO(orders.filter(o => o.status === stage.status)),
  }));

  const urgencyBadge = (u: string) =>
    u === 'critical' ? 'bg-red-500/20 text-red-400'
    : u === 'urgent' ? 'bg-amber-500/20 text-amber-500'
    : 'bg-white/10 text-slate-400';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Truck size={22} className="text-blue-500" /> Supply Chain Tracker
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Orders are grouped by Purchase Order. Marking delivery auto-adds stock to inventory.
          </p>
        </div>

        {stores.length > 1 && (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/5 overflow-x-auto scrollbar-hide">
            {stores.map((s: Store) => (
              <button key={s.id}
                onClick={() => setCurrentStore(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  currentStore?.id === s.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Building2 size={11} />
                {s.name.split('—')[0].trim()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 rounded-xl text-xs text-blue-300"
        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <Package size={14} className="text-blue-400 shrink-0 mt-0.5" />
        <span>
          Clicking <strong>Delivered — Add to Inventory</strong> creates a new batch in that pharmacy's stock with a default 2-year expiry.
          You can update the expiry and location in <strong>Stock View → expand batch → edit (✎)</strong>.
        </span>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide min-h-[55vh]">
        {stageGroups.map(stage => (
          <div key={stage.status}
            className="flex-1 min-w-[280px] bg-white/5 border border-white/5 rounded-3xl p-4 flex flex-col">

            <div className="flex justify-between items-center mb-4 px-1">
              <div>
                <h3 className="font-bold text-slate-200 text-sm">{stage.title}</h3>
                <p className="text-[10px] text-slate-600 mt-0.5">{stage.desc}</p>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-black/20 px-2 py-0.5 rounded-full">
                {stage.poGroups.length}
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-hide">
              {stage.poGroups.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-25 border-2 border-dashed border-white/5 rounded-2xl py-12">
                  <PackageOpen size={24} className="text-slate-500 mb-2" />
                  <p className="text-xs text-slate-500">No orders here</p>
                </div>
              ) : (
                stage.poGroups.map(([poId, poOrders]) => {
                  const totalValue = poOrders.reduce((s, o) => s + o.totalValue, 0);
                  const mainUrgency =
                    poOrders.some(o => o.urgency === 'critical') ? 'critical' :
                    poOrders.some(o => o.urgency === 'urgent')   ? 'urgent'   : 'routine';
                  const isAdvancing = advancing === poId;
                  const pendingApproval = poOrders.some(o => o.approvalStatus === 'pending');

                  const btnLabel: Record<string, string> = {
                    pending:    'Mark Confirmed',
                    confirmed:  'Mark Dispatched',
                    dispatched: 'Delivered — Add to Inventory',
                  };

                  return (
                    <motion.div key={poId} layout
                      className="bg-navy-900 border border-white/10 rounded-2xl p-4 hover:border-blue-500/30 transition-colors">

                      {/* PO header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-mono text-slate-600 truncate">{poId}</p>
                          <p className="text-xs font-bold text-white mt-0.5">
                            {poOrders.length} line{poOrders.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0 ${urgencyBadge(mainUrgency)}`}>
                          {mainUrgency === 'critical' && <AlertCircle size={9} />}
                          {mainUrgency}
                        </span>
                      </div>

                      {/* Medicine lines preview */}
                      <div className="space-y-1 mb-3 border-b border-white/5 pb-3">
                        {poOrders.slice(0, 4).map(o => (
                          <div key={o.id} className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-300 truncate max-w-[140px]">{o.medicineName ?? o.medicineId}</span>
                            <span className="text-slate-500 font-mono shrink-0 ml-2">×{o.quantity}</span>
                          </div>
                        ))}
                        {poOrders.length > 4 && (
                          <p className="text-[9px] text-slate-600">+{poOrders.length - 4} more medicines</p>
                        )}
                      </div>

                      {/* Value + time */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          ₹{totalValue.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9px] text-slate-600 flex items-center gap-1 font-mono">
                          <Clock size={9} />
                          {formatDistanceToNow(new Date(poOrders[0].orderedAt))} ago
                        </span>
                      </div>

                      {/* Approval warning */}
                      {pendingApproval && (
                        <p className="text-[9px] text-amber-400 font-bold mb-2 flex items-center gap-1">
                          <AlertCircle size={9} /> Admin approval required
                        </p>
                      )}

                      {/* Advance button */}
                      {btnLabel[stage.status] && (
                        <button
                          onClick={() => advancePO(poId, poOrders)}
                          disabled={isAdvancing || pendingApproval}
                          className={`w-full text-[10px] font-bold py-2.5 px-3 rounded-xl transition-all uppercase tracking-wider disabled:opacity-40 flex items-center justify-center gap-1.5 ${
                            stage.status === 'dispatched'
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-400 hover:bg-blue-600 hover:text-white'
                          }`}
                        >
                          {isAdvancing
                            ? <><RefreshCw size={11} className="animate-spin" /> Processing…</>
                            : stage.status === 'dispatched'
                            ? <><CheckCircle2 size={11} /> Delivered + Add to Inventory</>
                            : btnLabel[stage.status]
                          }
                        </button>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        ))}

        {/* Delivered column */}
        <DeliveredColumn currentStore={currentStore} />
      </div>
    </motion.div>
  );
}

// ── Delivered column (live sub-component) ─────────────────────────────────
function DeliveredColumn({ currentStore }: { currentStore: any }) {
  const [delivered, setDelivered] = useState<Order[]>([]);

  useEffect(() => {
    if (!currentStore) return;
    const q = query(
      collection(db, 'orders'),
      where('storeId', '==', currentStore.id),
      where('status', '==', 'delivered')
    );
    return onSnapshot(q, snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Order))
        .sort((a, b) =>
          new Date(b.deliveredAt ?? b.orderedAt).getTime() -
          new Date(a.deliveredAt ?? a.orderedAt).getTime()
        )
        .slice(0, 20);
      setDelivered(data);
    });
  }, [currentStore?.id]);

  const byPO = groupByPO(delivered);

  return (
    <div className="flex-1 min-w-[260px] rounded-3xl p-4 flex flex-col"
      style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)' }}>
      <div className="flex justify-between items-center mb-4 px-1">
        <div>
          <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 size={14} /> Delivered
          </h3>
          <p className="text-[10px] text-slate-600 mt-0.5">Inventory updated</p>
        </div>
        <span className="text-xs font-bold text-slate-500 bg-black/20 px-2 py-0.5 rounded-full">
          {byPO.length}
        </span>
      </div>

      <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-hide">
        {byPO.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-25 border-2 border-dashed rounded-2xl py-12"
            style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
            <Package size={24} className="text-slate-500 mb-2" />
            <p className="text-xs text-slate-500">No deliveries yet</p>
          </div>
        ) : byPO.map(([poId, poOrders]) => {
          const totalValue = poOrders.reduce((s, o) => s + o.totalValue, 0);
          return (
            <div key={poId} className="rounded-2xl p-3"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[9px] font-mono text-slate-600 truncate flex-1">{poId}</p>
                {poOrders.some(o => o.inventoryAdded) && (
                  <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-0.5 shrink-0 ml-1">
                    <CheckCircle2 size={9} /> Added
                  </span>
                )}
              </div>
              <div className="space-y-0.5 mb-2">
                {poOrders.slice(0, 3).map(o => (
                  <div key={o.id} className="flex items-center justify-between text-[9px]">
                    <span className="text-slate-400 truncate max-w-[120px]">{o.medicineName}</span>
                    <span className="text-slate-600 font-mono">×{o.quantity}</span>
                  </div>
                ))}
                {poOrders.length > 3 && (
                  <p className="text-[9px] text-slate-600">+{poOrders.length - 3} more</p>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono font-bold text-emerald-400">
                  ₹{totalValue.toLocaleString('en-IN')}
                </span>
                {poOrders[0].deliveredAt && (
                  <span className="text-[9px] text-slate-600">
                    {formatDistanceToNow(new Date(poOrders[0].deliveredAt))} ago
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
