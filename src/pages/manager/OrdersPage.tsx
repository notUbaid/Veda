import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, getDocs
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Batch, Order, Store, OrderLineItem } from '../../types';
import {
  ShoppingCart, Search, Package, ChevronDown, CheckCircle2,
  AlertCircle, History, MapPin, AlertTriangle, Plus, Minus,
  Trash2, FileText, Building2, X, ShoppingBag, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { writeAudit } from '../../services/auditService';
import { emailOrderPlaced } from '../../services/emailService';
import { getRecipientEmails } from '../../services/notifyHelpers';
import { generatePurchaseOrderPDF } from '../../services/pdfService';
import { differenceInDays, format } from 'date-fns';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',    color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  confirmed:  { label: 'Confirmed',  color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
  dispatched: { label: 'Dispatched', color: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/20' },
  delivered:  { label: 'Delivered',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  cancelled:  { label: 'Cancelled',  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
};

function sortFEFO(batches: Batch[]): Batch[] {
  return [...batches]
    .filter(b => !b.isDepleted && !b.isDisposed && b.quantity > 0 && new Date(b.expiryDate) > new Date())
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
}

// ── Cart item ──────────────────────────────────────────────────────────────
interface CartItem {
  medicine: Medicine;
  quantity: number;
}

export function OrdersPage() {
  const { profile, stores, currentStore, setCurrentStore } = useAuth();

  // All medicines & batches across selected store
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  // Orders for selected store
  const [orders, setOrders] = useState<Order[]>([]);

  // Target store for ordering (separate from currentStore browsing)
  const [targetStore, setTargetStore] = useState<Store | null>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'critical'>('routine');
  const [orderNotes, setOrderNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [successPO, setSuccessPO] = useState('');

  // Browse / search
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  // Accordions
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(true);

  // Init target store to currentStore
  useEffect(() => {
    if (!targetStore && currentStore) setTargetStore(currentStore);
  }, [currentStore]);

  // Load medicines, batches, orders for target store
  useEffect(() => {
    if (!targetStore) return;
    const u1 = onSnapshot(
      query(collection(db, 'medicines'), where('storeId', '==', targetStore.id)),
      s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine)))
    );
    const u2 = onSnapshot(
      query(collection(db, 'batches'), where('storeId', '==', targetStore.id), where('isDepleted', '==', false)),
      s => setBatches(s.docs.map(d => ({ id: d.id, ...d.data() } as Batch)))
    );
    const u3 = onSnapshot(
      query(collection(db, 'orders'), where('storeId', '==', targetStore.id)),
      s => setOrders(
        s.docs.map(d => ({ id: d.id, ...d.data() } as Order))
          .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
      )
    );
    // Clear cart when switching stores
    setCart([]);
    return () => { u1(); u2(); u3(); };
  }, [targetStore?.id]);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(medicines.map(m => m.category).filter(Boolean))).sort()],
    [medicines]
  );

  const filteredMedicines = useMemo(() => medicines.filter(m => {
    const q = search.toLowerCase();
    const match = m.name.toLowerCase().includes(q) ||
      (m.genericName || '').toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q);
    return match && (categoryFilter === 'All' || m.category === categoryFilter);
  }), [medicines, search, categoryFilter]);

  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.medicine.unitPrice, 0);
  const cartQtyTotal = cart.reduce((s, i) => s + i.quantity, 0);

  // Add medicine to cart or increment
  const addToCart = (med: Medicine, qty = 1) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.medicine.id === med.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + qty };
        return updated;
      }
      return [...prev, { medicine: med, quantity: qty }];
    });
  };

  const updateCartQty = (medId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.medicine.id !== medId));
    } else {
      setCart(prev => prev.map(i => i.medicine.id === medId ? { ...i, quantity: qty } : i));
    }
  };

  const removeFromCart = (medId: string) => {
    setCart(prev => prev.filter(i => i.medicine.id !== medId));
  };

  // Place entire cart as purchase order
  const handlePlaceOrder = async () => {
    if (!targetStore || !profile || cart.length === 0 || placing) return;
    setPlacing(true);
    try {
      const poId = `PO-${Date.now().toString(36).toUpperCase()}`;
      const now = new Date().toISOString();
      const needsApproval = cartTotal > 50000;

      // Write one Order doc per cart line (so supply chain can track per-medicine)
      for (const item of cart) {
        const lineTotal = item.quantity * item.medicine.unitPrice;
        await addDoc(collection(db, 'orders'), {
          storeId:         targetStore.id,
          storeName:       targetStore.name,
          purchaseOrderId: poId,
          medicineId:      item.medicine.id,
          medicineName:    item.medicine.name,
          quantity:        item.quantity,
          unitPrice:       item.medicine.unitPrice,
          totalValue:      lineTotal,
          supplier:        item.medicine.supplier,
          status:          'pending',
          urgency,
          aiSuggested:     false,
          orderedAt:       now,
          approvalStatus:  needsApproval ? 'pending' : 'auto',
          type:            'requisition',
          notes:           orderNotes || null,
          inventoryAdded:  false,
        });
      }

      // Audit
      await writeAudit(profile.email, targetStore.id, 'CREATE_PURCHASE_ORDER', 'order', poId, {
        poId, items: cart.length, total: cartTotal, urgency, store: targetStore.name,
      });

      // Generate PDF
      const lineItems: OrderLineItem[] = cart.map(i => ({
        medicineId:   i.medicine.id,
        medicineName: i.medicine.name,
        genericName:  i.medicine.genericName,
        quantity:     i.quantity,
        unitPrice:    i.medicine.unitPrice,
        unit:         i.medicine.unit,
        supplier:     i.medicine.supplier,
        lineTotal:    i.quantity * i.medicine.unitPrice,
      }));

      // Lookup store full data for PDF
      const storeSnap = await getDocs(query(collection(db, 'stores'), where('__name__', '==', targetStore.id)));
      const storeData = storeSnap.empty
        ? { ...targetStore, hospitalName: 'Hospital', contact: '' }
        : { id: storeSnap.docs[0].id, ...storeSnap.docs[0].data() } as Store;

      generatePurchaseOrderPDF({
        poId,
        store:     storeData,
        manager:   profile,
        storeName: targetStore.name,
        lineItems,
        urgency,
        notes:     orderNotes || undefined,
      });

      // Email
      emailOrderPlaced({
        recipientName:   profile.name,
        recipientEmails: getRecipientEmails(profile),
        medicineName:    cart.length === 1 ? cart[0].medicine.name : `${cart.length} medicines`,
        quantity:        cartQtyTotal,
        unitPrice:       0,
        totalValue:      cartTotal,
        urgency,
        supplier:        [...new Set(cart.map(i => i.medicine.supplier))].join(', '),
        storeName:       targetStore.name,
        needsApproval,
      }).catch(console.warn);

      setCart([]);
      setOrderNotes('');
      setUrgency('routine');
      setSuccessPO(poId);
      setTimeout(() => setSuccessPO(''), 5000);
    } catch (err: any) {
      alert('Order failed: ' + err.message);
    } finally {
      setPlacing(false);
    }
  };

  const activeOrders  = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const historyOrders = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));

  // Group active orders by PO
  const activePOs = useMemo(() => {
    const byPO: Record<string, Order[]> = {};
    activeOrders.forEach(o => {
      const key = o.purchaseOrderId || o.id;
      if (!byPO[key]) byPO[key] = [];
      byPO[key].push(o);
    });
    return Object.entries(byPO).sort(([, a], [, b]) =>
      new Date(b[0].orderedAt).getTime() - new Date(a[0].orderedAt).getTime()
    );
  }, [activeOrders]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* ── Store Selector ────────────────────────────────────── */}
      {stores.length > 1 && (
        <div className="glass-panel p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 shrink-0">
              <Building2 size={15} className="text-blue-400" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ordering for:</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {stores.map(s => (
                <button key={s.id}
                  onClick={() => setTargetStore(s)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                    targetStore?.id === s.id
                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20'
                      : 'text-slate-400 border-white/10 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Building2 size={12} />
                  {s.name.split('—')[0].trim()}
                </button>
              ))}
            </div>
            {targetStore && (
              <span className="text-[10px] text-slate-500 font-mono hidden sm:block">
                {targetStore.location}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Success banner ────────────────────────────────────── */}
      <AnimatePresence>
        {successPO && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
            <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-emerald-400 text-sm">Purchase Order Placed!</p>
              <p className="text-[11px] text-slate-400 font-mono">{successPO} · PDF downloaded · Email sent</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

        {/* ── LEFT: Browse + cart ───────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Search & filter */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
              <input
                type="text"
                placeholder="Search medicines to order..."
                className="glass-input w-full pl-10 py-2.5 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowCategoryMenu(v => !v)}
                className="h-full px-4 glass-button-secondary flex items-center gap-2 text-sm whitespace-nowrap"
              >
                {categoryFilter === 'All' ? 'All' : categoryFilter}
                <ChevronDown size={13} />
              </button>
              <AnimatePresence>
                {showCategoryMenu && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute right-0 top-full mt-2 w-44 glass-panel p-2 z-50 space-y-0.5 shadow-2xl max-h-64 overflow-y-auto scrollbar-hide">
                    {categories.map(cat => (
                      <button key={cat}
                        onClick={() => { setCategoryFilter(cat); setShowCategoryMenu(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          categoryFilter === cat ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
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

          {/* Medicine catalogue */}
          <div className="space-y-2">
            {filteredMedicines.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Package size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-bold text-white">No medicines found</p>
                {search && <p className="text-sm mt-1">Try a different search term.</p>}
              </div>
            ) : (
              filteredMedicines.map(med => {
                const medBatches = sortFEFO(batches.filter(b => b.medicineId === med.id));
                const totalStock = medBatches.reduce((s, b) => s + b.quantity, 0);
                const isLow      = totalStock < med.reorderThreshold;
                const inCart     = cart.find(i => i.medicine.id === med.id);
                const nearestExp = medBatches[0]
                  ? differenceInDays(new Date(medBatches[0].expiryDate), new Date())
                  : null;

                return (
                  <div key={med.id}
                    className={`glass-panel p-4 flex items-center gap-4 transition-all border ${
                      inCart ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/5'
                    }`}
                  >
                    {/* Left: info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <p className="font-bold text-sm text-white truncate">{med.name}</p>
                        {isLow && (
                          <span className="shrink-0 text-[9px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded uppercase">Low</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mb-2">{med.genericName} · {med.category}</p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="font-mono font-bold text-emerald-400">₹{med.unitPrice}/{med.unit}</span>
                        <span className={`font-mono ${totalStock <= 0 ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-slate-400'}`}>
                          Stock: {totalStock} {med.unit}
                        </span>
                        {nearestExp !== null && (
                          <span className={`font-mono text-[10px] ${nearestExp <= 30 ? 'text-amber-400' : 'text-slate-500'}`}>
                            Exp: {nearestExp}d
                          </span>
                        )}
                        <span className="text-slate-600 text-[10px]">{med.supplier}</span>
                      </div>
                    </div>

                    {/* Right: add/qty controls */}
                    <div className="shrink-0">
                      {inCart ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartQty(med.id, inCart.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={inCart.quantity}
                            onChange={e => updateCartQty(med.id, parseInt(e.target.value) || 1)}
                            className="w-16 glass-input py-1.5 text-center font-mono font-bold text-sm text-blue-400"
                          />
                          <button
                            onClick={() => updateCartQty(med.id, inCart.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            onClick={() => removeFromCart(med.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(med, Math.max(1, med.reorderThreshold - totalStock))}
                          className="flex items-center gap-2 px-4 py-2 glass-button-secondary text-xs font-bold hover:bg-blue-600 hover:text-white transition-all"
                        >
                          <Plus size={13} /> Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT: Cart + place order ─────────────────────── */}
        <div className="xl:col-span-1 space-y-4 sticky top-4">

          {/* Cart panel */}
          <div className="glass-panel overflow-hidden">
            {/* Cart header */}
            <button
              onClick={() => setCartOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-blue-400" />
                <span className="font-bold text-sm text-white">Order Cart</span>
                {cart.length > 0 && (
                  <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    {cart.length}
                  </span>
                )}
              </div>
              <ChevronDown size={14} className={`text-slate-500 transition-transform ${cartOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {cartOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-white/5"
                >
                  {cart.length === 0 ? (
                    <div className="py-10 text-center opacity-40">
                      <ShoppingBag size={28} className="mx-auto mb-2 text-slate-500" />
                      <p className="text-slate-400 text-sm font-bold">Cart is empty</p>
                      <p className="text-xs text-slate-600 mt-1">Add medicines from the list</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {cart.map(item => (
                        <div key={item.medicine.id} className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{item.medicine.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {item.quantity} {item.medicine.unit} × ₹{item.medicine.unitPrice}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <p className="text-xs font-mono font-bold text-emerald-400 w-16 text-right">
                              ₹{(item.quantity * item.medicine.unitPrice).toLocaleString('en-IN')}
                            </p>
                            <button onClick={() => removeFromCart(item.medicine.id)}
                              className="text-slate-600 hover:text-red-400 transition-colors p-1">
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Totals */}
                      <div className="px-4 py-3 bg-white/5">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>{cart.length} line{cart.length !== 1 ? 's' : ''} · {cartQtyTotal} units</span>
                          {cartTotal > 50000 && (
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <AlertCircle size={11} /> Admin approval
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Total</span>
                          <span className="font-mono font-bold text-white text-lg">
                            ₹{cartTotal.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Urgency */}
                      <div className="px-4 py-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Urgency</p>
                        <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
                          {(['routine', 'urgent', 'critical'] as const).map(u => (
                            <button key={u} type="button" onClick={() => setUrgency(u)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                                urgency === u
                                  ? u === 'critical' ? 'bg-red-500/20 text-red-400'
                                    : u === 'urgent' ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-white/15 text-white'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}>{u}</button>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="px-4 py-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Notes (optional)</p>
                        <textarea
                          rows={2}
                          className="glass-input w-full py-2 px-3 text-xs resize-none"
                          placeholder="e.g. Urgent restock for ICU ward..."
                          value={orderNotes}
                          onChange={e => setOrderNotes(e.target.value)}
                        />
                      </div>

                      {/* Place order button */}
                      <div className="px-4 py-4">
                        <button
                          onClick={handlePlaceOrder}
                          disabled={placing || cart.length === 0}
                          className="w-full glass-button-primary py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                        >
                          {placing ? (
                            <><RefreshCw size={14} className="animate-spin" /> Placing Order...</>
                          ) : (
                            <><FileText size={14} /> Place Purchase Order</>
                          )}
                        </button>
                        <p className="text-[10px] text-slate-600 text-center mt-2">
                          PDF will download automatically
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Active POs */}
          {activePOs.length > 0 && (
            <div className="glass-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Active Orders</p>
                <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold">
                  {activePOs.length}
                </span>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-hide">
                {activePOs.map(([poId, poOrders]) => {
                  const meta  = STATUS_META[poOrders[0].status] ?? STATUS_META.pending;
                  const total = poOrders.reduce((s, o) => s + o.totalValue, 0);
                  return (
                    <div key={poId} className="p-3 rounded-xl bg-white/5 border border-white/5">

                      {/* PO id + status badge */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-mono text-slate-600 truncate max-w-[120px]">{poId}</span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${meta.bg} ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>

                      {/* Single medicine — show name directly */}
                      {poOrders.length === 1 ? (
                        <div>
                          <p className="text-sm font-bold text-white truncate">{poOrders[0].medicineName ?? 'Unknown'}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Qty: {poOrders[0].quantity} &nbsp;·&nbsp;
                            <span className="text-emerald-400">₹{total.toLocaleString('en-IN')}</span>
                          </p>
                        </div>
                      ) : (
                        /* Multiple medicines — list each */
                        <div className="space-y-1">
                          {poOrders.slice(0, 3).map(o => (
                            <div key={o.id} className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-white truncate">{o.medicineName ?? 'Unknown'}</p>
                              <p className="text-[10px] text-slate-500 font-mono shrink-0">×{o.quantity}</p>
                            </div>
                          ))}
                          {poOrders.length > 3 && (
                            <p className="text-[10px] text-slate-600">+{poOrders.length - 3} more</p>
                          )}
                          <p className="text-[10px] text-emerald-400 font-mono pt-1 mt-1 border-t border-white/5">
                            ₹{total.toLocaleString('en-IN')} total
                          </p>
                        </div>
                      )}

                      {poOrders[0].approvalStatus === 'pending' && (
                        <p className="text-[9px] text-amber-400 mt-1.5">⏳ Awaiting admin approval</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── History accordion ─────────────────────────────────── */}
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
                        <th className="py-3 px-4 hidden sm:table-cell">PO</th>
                        <th className="py-3 px-4 text-center">Urgency</th>
                        <th className="py-3 px-4 text-right">Value</th>
                        <th className="py-3 px-5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {historyOrders.map(order => {
                        const meta = STATUS_META[order.status] ?? STATUS_META.delivered;
                        return (
                          <tr key={order.id} className="hover:bg-white/5 transition-colors opacity-60 hover:opacity-100">
                            <td className="py-3 px-5 text-xs text-slate-500 font-mono whitespace-nowrap">
                              {new Date(order.orderedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-sm font-bold text-white">{order.medicineName ?? 'Unknown'}</p>
                              <p className="text-xs text-slate-600 font-mono">Qty: {order.quantity}</p>
                            </td>
                            <td className="py-3 px-4 hidden sm:table-cell text-[10px] text-slate-600 font-mono">
                              {order.purchaseOrderId ?? '—'}
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
                              <div className="flex flex-col items-end gap-1">
                                <span className={`text-[10px] font-bold uppercase ${meta.color}`}>{meta.label}</span>
                                {order.inventoryAdded && (
                                  <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
                                    <CheckCircle2 size={9} /> Stock added
                                  </span>
                                )}
                              </div>
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
    </motion.div>
  );
}
