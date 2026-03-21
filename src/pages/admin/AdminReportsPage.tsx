import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Store, Order, WasteRecord, DispenseLog } from '../../types';
import { BarChart3, TrendingUp, Trash2, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

export function AdminReportsPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [waste, setWaste] = useState<WasteRecord[]>([]);
  const [logs, setLogs] = useState<DispenseLog[]>([]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'stores'), (s) =>
      setStores(s.docs.map((d) => ({ id: d.id, ...d.data() } as Store)))
    );
    const u2 = onSnapshot(collection(db, 'orders'), (s) =>
      setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() } as Order)))
    );
    const u3 = onSnapshot(collection(db, 'waste_records'), (s) =>
      setWaste(s.docs.map((d) => ({ id: d.id, ...d.data() } as WasteRecord)))
    );
    const u4 = onSnapshot(
      query(collection(db, 'dispense_logs'), orderBy('timestamp', 'desc'), limit(500)),
      (s) => setLogs(s.docs.map((d) => ({ id: d.id, ...d.data() } as DispenseLog)))
    );
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  // Procurement value per store
  const storeOrderData = stores.map((s) => ({
    name: s.name.split('—')[0].trim(),
    value: orders
      .filter((o) => o.storeId === s.id && o.status === 'delivered')
      .reduce((sum, o) => sum + o.totalValue, 0),
  }));

  // Waste value per store
  const storeWasteData = stores.map((s) => ({
    name: s.name.split('—')[0].trim(),
    value: waste.filter((w) => w.storeId === s.id).reduce((sum, w) => sum + w.wasteValue, 0),
  }));

  // Order status breakdown
  const statusCounts = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'].map((st) => ({
    name: st,
    value: orders.filter((o) => o.status === st).length,
  })).filter((d) => d.value > 0);

  const COLORS = ['#f59e0b', '#3b82f6', '#6366f1', '#10b981', '#ef4444'];

  const totalProcurement = orders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + o.totalValue, 0);

  const totalWaste = waste.reduce((sum, w) => sum + w.wasteValue, 0);
  const totalDispenses = logs.length;
  const pendingApprovals = orders.filter((o) => o.approvalStatus === 'pending').length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
          <BarChart3 size={24} className="text-blue-500" /> Global Reports
        </h2>
        <p className="text-slate-400 text-sm">
          Aggregated network telemetry across all pharmacy nodes.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Procurement', value: `₹${(totalProcurement / 100000).toFixed(1)}L`, icon: ShoppingCart, color: 'text-emerald-400' },
          { label: 'Network Waste', value: `₹${(totalWaste / 1000).toFixed(1)}K`, icon: Trash2, color: 'text-red-400' },
          { label: 'Total Dispenses', value: totalDispenses, icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Pending Approvals', value: pendingApprovals, icon: BarChart3, color: pendingApprovals > 0 ? 'text-amber-400' : 'text-slate-400' },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-panel p-5"
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                {s.label}
              </p>
              <s.icon size={14} className={s.color} />
            </div>
            <p className={`text-2xl font-mono font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Procurement by store */}
        <div className="glass-panel p-6">
          <h3 className="font-bold text-white mb-5 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" />
            Procurement Value by Store
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={storeOrderData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis
                type="number"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
                formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Value']}
              />
              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Waste by store */}
        <div className="glass-panel p-6">
          <h3 className="font-bold text-white mb-5 flex items-center gap-2">
            <Trash2 size={16} className="text-red-400" />
            Waste Value by Store
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={storeWasteData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis
                type="number"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
                formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Waste']}
              />
              <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Order status breakdown */}
        <div className="glass-panel p-6">
          <h3 className="font-bold text-white mb-5">Order Status Distribution</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie
                  data={statusCounts}
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusCounts.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {statusCounts.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-xs text-slate-400 capitalize">{d.name}</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-white">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="glass-panel p-6">
          <h3 className="font-bold text-white mb-5">Network Summary</h3>
          <div className="space-y-4">
            {[
              { label: 'Active Pharmacy Nodes', value: stores.length },
              { label: 'Total Orders Processed', value: orders.length },
              { label: 'Delivered Orders', value: orders.filter((o) => o.status === 'delivered').length },
              { label: 'Total Waste Records', value: waste.length },
              { label: 'Dispense Transactions', value: totalDispenses },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
              >
                <span className="text-sm text-slate-400">{item.label}</span>
                <span className="text-sm font-mono font-bold text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
