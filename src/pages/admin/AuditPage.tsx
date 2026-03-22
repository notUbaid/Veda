import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { AuditLog, Store } from '../../types';
import { FileText, Search, Download, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const u1 = onSnapshot(
      query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(500)),
      s => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)))
    );
    const u2 = onSnapshot(collection(db, 'stores'), s =>
      setStores(s.docs.map(d => ({ id: d.id, ...d.data() } as Store)))
    );
    return () => { u1(); u2(); };
  }, []);

  const filtered = search.length > 2
    ? logs.filter(l =>
        l.userEmail.includes(search) ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.details.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const exportCSV = () => {
    const rows = [
      ['Timestamp', 'Actor Email', 'Action', 'Entity Type', 'Entity ID', 'Store', 'Details'],
      ...filtered.map(l => {
        const store = stores.find(s => s.id === l.storeId);
        return [
          new Date(l.timestamp).toISOString(),
          l.userEmail,
          l.action,
          l.entityType,
          l.entityId ?? '',
          store?.name ?? l.storeId,
          l.details.replace(/,/g, ';'), // escape commas in details
        ];
      }),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `veda_audit_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl mx-auto">

      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
            <FileText size={24} className="text-blue-500" /> Immutable Audit Logs
          </h2>
          <p className="text-slate-400 text-sm">
            Every destructive or critical action is permanently logged. Last 500 records shown.
          </p>
        </div>
        <button onClick={exportCSV} disabled={filtered.length === 0}
          className="glass-button-secondary px-6 inline-flex items-center gap-2 disabled:opacity-40">
          <Download size={16} /> Export CSV ({filtered.length})
        </button>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/5 flex gap-4 items-center">
          <div className="relative w-96 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input type="text" placeholder="Search actor email, action, payload..."
              className="glass-input w-full pl-10 py-2.5 text-sm font-mono"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg ml-auto hidden sm:flex border border-white/5">
            <ShieldAlert size={12} className="text-emerald-500" /> Tamper-Proof
          </div>
        </div>

        <div className="overflow-x-auto min-h-[600px]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/5">
                <th className="py-4 pl-6 pr-4 whitespace-nowrap">Timestamp</th>
                <th className="py-4 px-4">Actor</th>
                <th className="py-4 px-4">Action</th>
                <th className="py-4 px-4">Node</th>
                <th className="py-4 px-6 w-1/3">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(log => {
                const store = stores.find(s => s.id === log.storeId);
                return (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 pl-6 pr-4 text-[11px] text-slate-400 font-mono whitespace-nowrap">
                      {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-3 px-4 font-bold text-xs text-blue-400 font-mono">
                      {log.userEmail}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                        log.action.includes('DISPENSE') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : log.action.includes('CREATE') || log.action.includes('ORDER') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : log.action.includes('WASTE') || log.action.includes('DELETE') ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : log.action.includes('UPDATE') ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-white/5 text-slate-300 border-white/10'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-500">
                      {store?.name || (log.storeId === 'global' ? 'Global' : log.storeId?.slice(0, 8) ?? '—')}
                    </td>
                    <td className="py-3 px-6">
                      <div className="bg-black/40 border border-white/5 rounded p-2 text-[10px] font-mono text-slate-300 break-all leading-relaxed h-14 overflow-y-auto scrollbar-hide">
                        {log.details}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-500 font-mono text-sm">
                    [ ERR_NO_RECORDS_FOUND ]
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
