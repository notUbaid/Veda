import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Order, Store } from '../../types';
import {
  Package, Calendar, Search, Download,
  ChevronDown, CheckCircle2, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLOR: Record<string, string> = {
  pending:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  confirmed:  'text-blue-400 bg-blue-500/10 border-blue-500/20',
  dispatched: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  delivered:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  cancelled:  'text-red-400 bg-red-500/10 border-red-500/20',
};

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'stores'), s =>
      setStores(s.docs.map(d => ({ id: d.id, ...d.data() } as Store)))
    );
    const u2 = onSnapshot(query(collection(db, 'orders')), s => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      setOrders(data.sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime()));
    });
    return () => { u1(); u2(); };
  }, []);

  // Filter
  const filtered = useMemo(() => orders.filter(o => {
    const store = stores.find(s => s.id === o.storeId);
    const name = o.medicineName ?? '';
    const matchSearch = search.length < 2 ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      (store?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.purchaseOrderId ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchStore  = storeFilter  === 'all' || o.storeId === storeFilter;
    return matchSearch && matchStatus && matchStore;
  }), [orders, search, statusFilter, storeFilter, stores]);

  // Group by PO
  const groupedPOs = useMemo(() => {
    const byPO: Record<string, Order[]> = {};
    filtered.forEach(o => {
      const key = o.purchaseOrderId || o.id;
      if (!byPO[key]) byPO[key] = [];
      byPO[key].push(o);
    });
    return Object.entries(byPO)
      .sort(([, a], [, b]) => new Date(b[0].orderedAt).getTime() - new Date(a[0].orderedAt).getTime());
  }, [filtered]);

  // Summary stats
  const stats = useMemo(() => ({
    total:     orders.length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    pending:   orders.filter(o => o.approvalStatus === 'pending').length,
    value:     orders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.totalValue, 0),
  }), [orders]);

  const exportCSV = () => {
    const rows = [
      ['PO ID', 'Date', 'Store', 'Medicine', 'Qty', 'Unit Price', 'Total (₹)', 'Urgency', 'Status', 'Approval'],
      ...filtered.map(o => {
        const store = stores.find(s => s.id === o.storeId);
        return [
          o.purchaseOrderId ?? o.id,
          new Date(o.orderedAt).toLocaleString('en-GB'),
          store?.name ?? o.storeId,
          o.medicineName ?? o.medicineId,
          o.quantity,
          o.unitPrice,
          o.totalValue,
          o.urgency,
          o.status,
          o.approvalStatus,
        ];
      }),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `orders_global_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl mx-auto">

      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Global Requisitions</h2>
          <p className="text-slate-400 text-sm">All Purchase Orders across the network, grouped by PO.</p>
        </div>
        <button onClick={exportCSV} className="glass-button-secondary px-4 py-2 flex items-center gap-2 text-sm">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Order Lines', value: stats.total, color: 'text-white' },
          { label: 'Delivered', value: stats.delivered, color: 'text-emerald-400' },
          { label: 'Awaiting Approval', value: stats.pending, color: stats.pending > 0 ? 'text-amber-400' : 'text-slate-400' },
          { label: 'Delivered Value', value: `₹${(stats.value / 100000).toFixed(1)}L`, color: 'text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="glass-panel p-4">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">{s.label}</p>
            <p className={`text-2xl font-mono font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/5 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input type="text" className="glass-input w-full pl-9 py-2 text-sm" placeholder="Search PO, medicine, store..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 p-1 glass-input border border-white/5 w-fit">
            {(['all', 'pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded text-xs font-bold transition-all capitalize ${
                  statusFilter === s ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}>
                {s}
              </button>
            ))}
          </div>

          {/* Store filter */}
          <select className="glass-input py-2 text-xs" value={storeFilter} onChange={e => setStoreFilter(e.target.value)}>
            <option value="all">All Stores</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <span className="ml-auto text-xs text-slate-500">{groupedPOs.length} POs · {filtered.length} lines</span>
        </div>

        {/* PO rows */}
        <div className="divide-y divide-white/5 min-h-[400px]">
          {groupedPOs.length === 0 ? (
            <div className="py-24 text-center text-slate-500">
              <Package size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-white">No orders found</p>
            </div>
          ) : groupedPOs.map(([poId, poOrders]) => {
            const store      = stores.find(s => s.id === poOrders[0].storeId);
            const totalValue = poOrders.reduce((s, o) => s + o.totalValue, 0);
            const isExpanded = expandedPO === poId;
            // Derive overall PO status
            const poStatus = poOrders.every(o => o.status === 'delivered') ? 'delivered'
              : poOrders.every(o => o.status === 'cancelled') ? 'cancelled'
              : poOrders.some(o => o.status === 'dispatched') ? 'dispatched'
              : poOrders.some(o => o.status === 'confirmed') ? 'confirmed'
              : 'pending';

            return (
              <div key={poId}>
                {/* PO summary row */}
                <button
                  onClick={() => setExpandedPO(isExpanded ? null : poId)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors text-left"
                >
                  <ChevronDown size={14} className={`text-slate-500 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />

                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-4 items-center">
                    {/* PO + store */}
                    <div className="sm:col-span-2 min-w-0">
                      <p className="text-[10px] font-mono text-slate-600">{poId}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Building2 size={11} className="text-indigo-400 shrink-0" />
                        <span className="font-bold text-sm text-white truncate">{store?.name ?? 'Unknown'}</span>
                      </div>
                    </div>

                    {/* Lines + date */}
                    <div>
                      <p className="text-xs font-bold text-white">{poOrders.length} line{poOrders.length !== 1 ? 's' : ''}</p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Calendar size={9} />
                        {formatDistanceToNow(new Date(poOrders[0].orderedAt))} ago
                      </p>
                    </div>

                    {/* Value */}
                    <div>
                      <p className="text-sm font-mono font-bold text-emerald-400">₹{totalValue.toLocaleString('en-IN')}</p>
                      {poOrders[0].approvalStatus === 'pending' && (
                        <p className="text-[10px] text-amber-400 font-bold">Admin approval pending</p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${STATUS_COLOR[poStatus] ?? 'text-slate-400 bg-white/5 border-white/5'}`}>
                        {poStatus}
                      </span>
                      {poOrders.some(o => o.inventoryAdded) && (
                        <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
                          <CheckCircle2 size={9} /> Stocked
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded line items */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      <div className="bg-navy-950/50 p-4">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
                              <th className="pb-2 pl-2">Medicine</th>
                              <th className="pb-2 px-4 text-center">Urgency</th>
                              <th className="pb-2 px-4 text-right">Qty</th>
                              <th className="pb-2 px-4 text-right">Unit Price</th>
                              <th className="pb-2 px-4 text-right">Line Total</th>
                              <th className="pb-2 px-2 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {poOrders.map(o => (
                              <tr key={o.id} className="text-xs">
                                <td className="py-2.5 pl-2">
                                  <p className="font-bold text-white">{o.medicineName ?? '—'}</p>
                                  <p className="text-slate-500 font-mono text-[10px]">{o.supplier}</p>
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase border ${
                                    o.urgency === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : o.urgency === 'urgent' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                  }`}>{o.urgency}</span>
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono text-white">{o.quantity}</td>
                                <td className="py-2.5 px-4 text-right font-mono text-slate-400">₹{o.unitPrice.toFixed(2)}</td>
                                <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400">₹{o.totalValue.toLocaleString('en-IN')}</td>
                                <td className="py-2.5 px-2 text-right">
                                  <span className={`text-[9px] font-bold uppercase ${STATUS_COLOR[o.status]?.split(' ')[0] ?? 'text-slate-400'}`}>
                                    {o.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
