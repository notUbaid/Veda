import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Order, Medicine, Store } from '../../types';
import { Package, Calendar, Search } from 'lucide-react';
import { motion } from 'framer-motion';

export function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const u1 = onSnapshot(collection(db, 'medicines'), s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine))));
        const u2 = onSnapshot(collection(db, 'stores'), s => setStores(s.docs.map(d => ({ id: d.id, ...d.data() } as Store))));
        // Using snapshot without complex index to pull all orders globally
        const u3 = onSnapshot(query(collection(db, 'orders')), s => {
            const data = s.docs.map(d => ({ id: d.id, ...d.data() } as Order));
            setOrders(data.sort((a,b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime()));
        });
        return () => { u1(); u2(); u3(); };
    }, []);

    const filteredOrders = orders.filter(o => {
        const med = medicines.find(m => m.id === o.medicineId);
        const st = stores.find(s => s.id === o.storeId);
        if (search.length > 2) {
             const term = search.toLowerCase();
             return med?.name.toLowerCase().includes(term) || st?.name.toLowerCase().includes(term);
        }
        return true;
    });

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl mx-auto">
             <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Global Requisitions</h2>
                    <p className="text-slate-400 text-sm">Monitor all procurement flowing through the Veda network.</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input type="text" className="glass-input w-full pl-9 py-2 text-sm" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)}/>
                </div>
             </div>

             <div className="glass-panel overflow-hidden min-h-[600px]">
                 {filteredOrders.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-500 py-32 opacity-50">
                         <Package size={48} className="mb-4" />
                         <p className="font-bold text-lg">No Procurement History Found</p>
                     </div>
                 ) : (
                     <div className="overflow-x-auto">
                          <table className="w-full text-left relative">
                              <thead>
                                  <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-navy-900/50 sticky top-0 backdrop-blur-md">
                                      <th className="py-4 px-6">Ordered On</th>
                                      <th className="py-4 px-4">Node (Store)</th>
                                      <th className="py-4 px-4">Item Requested</th>
                                      <th className="py-4 px-4 text-center">Urgency</th>
                                      <th className="py-4 px-4 text-right">Value (₹)</th>
                                      <th className="py-4 px-6 text-right">Status</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                  {filteredOrders.map(order => {
                                      const med = medicines.find(m => m.id === order.medicineId);
                                      const node = stores.find(s => s.id === order.storeId);
                                      return (
                                          <tr key={order.id} className="hover:bg-white/5 transition-colors">
                                              <td className="py-4 px-6 text-xs text-slate-400 font-mono flex items-center gap-2"><Calendar size={12}/>{new Date(order.orderedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short' })}</td>
                                              <td className="py-4 px-4">
                                                  <p className="font-bold text-sm text-indigo-300">{node?.name || 'Unknown'}</p>
                                                  <p className="font-mono text-[10px] text-slate-500">{node?.location || 'Unknown'}</p>
                                              </td>
                                              <td className="py-4 px-4">
                                                  <p className="font-bold text-sm text-white">{med?.name || 'Unknown'}</p>
                                                  <p className="font-mono text-xs text-slate-500">Qty: {order.quantity}</p>
                                              </td>
                                              <td className="py-4 px-4 text-center">
                                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${order.urgency === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' : order.urgency === 'urgent' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>{order.urgency}</span>
                                              </td>
                                              <td className="py-4 px-4 text-right font-mono text-slate-300">₹{order.totalValue.toLocaleString('en-IN')}</td>
                                              <td className="py-4 px-6 text-right">
                                                  <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-white/5 rounded-lg border border-white/5 ${order.status === 'delivered' ? 'text-emerald-500' : order.status === 'dispatched' ? 'text-blue-500' : 'text-amber-500'}`}>
                                                      {order.status}
                                                  </span>
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
    );
}
