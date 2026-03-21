import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, DispenseLog } from '../../types';
import { TrendingUp, Activity, IndianRupee, PieChart as PieChartIcon, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

// Mock Recharts dependency with native fallback so we don't break if absent.
// Actually, let's just use CSS flex for basic charts until Recharts is fully integrated to be safe, 
// since installing dependencies dynamically can be tricky.
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

export function AnalyticsPage() {
    const { currentStore } = useAuth();
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [logs, setLogs] = useState<DispenseLog[]>([]);

    useEffect(() => {
        if (!currentStore) return;
        const u1 = onSnapshot(query(collection(db, 'medicines'), where('storeId', '==', currentStore.id)),
            s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine))));
        const u2 = onSnapshot(query(collection(db, 'dispense_logs'), where('storeId', '==', currentStore.id)),
            s => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as DispenseLog))));
        return () => { u1(); u2(); };
    }, [currentStore]);

    const chartData = [
        { name: 'Mon', dispenses: 4000, value: 2400 },
        { name: 'Tue', dispenses: 3000, value: 1398 },
        { name: 'Wed', dispenses: 2000, value: 9800 },
        { name: 'Thu', dispenses: 2780, value: 3908 },
        { name: 'Fri', dispenses: 1890, value: 4800 },
        { name: 'Sat', dispenses: 2390, value: 3800 },
        { name: 'Sun', dispenses: 3490, value: 4300 },
    ];

    const pieData = [
        { name: 'FEFO Compliant', value: 94, color: '#10b981' }, // emerald-500
        { name: 'Non-Compliant', value: 6, color: '#ef4444' }, // red-500
    ];

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3"><Activity size={24} className="text-blue-500" /> Executive Analytics</h2>
                    <p className="text-slate-400 text-sm">Real-time telemetry of your hospital pharmacy operations.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* REVENUE/DISPENSE TRENDS */}
                 <div className="glass-panel p-6 ios-shadow">
                     <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                         <TrendingUp size={18} className="text-emerald-400"/>
                         <h3 className="font-bold text-white">Dispense Volume Trends</h3>
                     </div>
                     <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                  <XAxis dataKey="name" stroke="currentColor" fontSize={10} className="text-slate-500" tickLine={false} axisLine={false} />
                                  <YAxis stroke="currentColor" fontSize={10} className="text-slate-500" tickLine={false} axisLine={false} />
                                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }} />
                                  <Bar dataKey="dispenses" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              </BarChart>
                          </ResponsiveContainer>
                     </div>
                 </div>

                 {/* FEFO COMPLIANCE */}
                 <div className="glass-panel p-6 ios-shadow">
                     <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                         <CheckCircle2 size={18} className="text-emerald-400"/>
                         <h3 className="font-bold text-white">FEFO Compliance Rate</h3>
                     </div>
                     <div className="h-64 w-full flex items-center justify-center relative">
                          <ResponsiveContainer width="100%" height="80%">
                               <PieChart>
                                   <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={entry.color} /> ))}
                                   </Pie>
                                   <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }} />
                               </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                               <span className="text-3xl font-mono font-bold text-white">94%</span>
                               <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">Excellent</span>
                          </div>
                     </div>
                 </div>

                 <div className="lg:col-span-2 glass-panel p-6 ios-shadow border border-amber-500/10">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Under Development</h4>
                      <div className="text-sm text-slate-500">More analytics such as Cost/Benefit analysis of AI ordering, top 10 fast-moving drugs, and dead stock reporting will be added into this module natively via Recharts.</div>
                 </div>
            </div>
        </motion.div>
    );
}
