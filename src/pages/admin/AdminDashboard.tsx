import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Store, UserProfile, Order, AuditLog } from '../../types';
import { Shield, Server, Users, Box, TrendingUp, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

export function AdminDashboard() {
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'stores'), s => setStores(s.docs.map(d => ({ id: d.id, ...d.data() } as Store))));
    const unsub2 = onSnapshot(collection(db, 'users'), s => setUsers(s.docs.map(d => ({ uid: d.id, ...d.data() } as unknown as UserProfile))));
    const unsub3 = onSnapshot(collection(db, 'orders'), s => setOrders(s.docs.map(d => ({ id: d.id, ...d.data() } as Order))));
    const unsub4 = onSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(15)), 
      s => setAuditLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog))));

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, []);

  const totalValue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.totalValue, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl mx-auto">
      
      {/* GLOBAL STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Network Nodes" value={stores.length} icon={Server} color="text-blue-500" />
          <StatCard label="Active Personnel" value={users.filter(u => u.isActive).length} icon={Users} color="text-indigo-400" />
          <StatCard label="Total Procurements" value={orders.length} icon={Box} color="text-amber-500" />
          <StatCard label="Network Value Flow" value={`₹${(totalValue / 100000).toFixed(1)}L`} icon={TrendingUp} color="text-emerald-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          <div className="xl:col-span-2 space-y-6">
              {/* SYSTEM HEALTH / MAP */}
              <div className="glass-panel p-6 h-[400px] flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full"/>
                  <div className="flex justify-between items-center mb-6 relative z-10">
                       <h3 className="font-bold text-lg text-white flex items-center gap-2"><Shield size={18} className="text-emerald-500"/> System Health</h3>
                       <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20 uppercase tracking-widest">
                           All Systems Nominal
                       </span>
                  </div>

                  <div className="flex-1 border border-white/5 rounded-2xl bg-black/20 relative flex items-center justify-center p-6 text-center">
                       {/* Abstract placeholder for map/health nodes */}
                       <div className="space-y-4 max-w-sm">
                            <Server size={48} className="mx-auto text-blue-500/50" />
                            <p className="text-sm text-slate-400 leading-relaxed">Network infrastructure is operating at peak capacity. Datastore syncing is optimal across all {stores.length} peripheral nodes.</p>
                       </div>
                  </div>
              </div>
          </div>

          <div className="space-y-6">
              {/* LIVE AUDIT STREAM */}
              <div className="glass-panel p-6 flex flex-col h-[400px]">
                  <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
                       <h3 className="font-bold text-white uppercase text-xs tracking-widest">Live Security Stream</h3>
                       <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"/>
                       </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                       {auditLogs.map(log => (
                           <div key={log.id} className="text-xs border-l-2 border-white/10 pl-3 py-1 hover:border-blue-500 transition-colors">
                               <p className="text-[9px] text-slate-500 font-mono mb-1">{formatDistanceToNow(new Date(log.timestamp))} ago</p>
                               <p className="text-slate-300 font-bold mb-0.5">{log.userEmail.split('@')[0]}</p>
                               <p className="text-slate-400 line-clamp-2 leading-relaxed">
                                   <span className={`font-bold mr-1 ${log.action.includes('DISPENSE') ? 'text-emerald-400' : log.action.includes('WASTE') ? 'text-red-400' : 'text-blue-400'}`}>{log.action}</span>
                                   {log.details.replace(/[{"}]/g, '').slice(0, 60)}...
                               </p>
                           </div>
                       ))}
                  </div>
              </div>
          </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-5">
            <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
                <div className="p-2 bg-white/5 rounded-lg"><Icon size={14} className={color} /></div>
            </div>
            <p className={`text-2xl font-mono font-bold ${color}`}>{value}</p>
        </motion.div>
    );
}
