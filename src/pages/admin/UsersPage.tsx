import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile, Store } from '../../types';
import { Users, Filter, UserPlus, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Form
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'pharmacist', storeId: '' });

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'users'), s => setUsers(s.docs.map(d => ({ uid: d.id, ...d.data() } as unknown as UserProfile))));
    const unsub2 = onSnapshot(collection(db, 'stores'), s => setStores(s.docs.map(d => ({ id: d.id, ...d.data() } as Store))));
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await addDoc(collection(db, 'users'), {
              ...formData,
              uid: 'TEMP_' + Date.now().toString(), // In a real app this would be Firebase Auth UID mapping
              isActive: true,
              createdAt: new Date().toISOString()
          });
          setIsAdding(false);
          setFormData({ name: '', email: '', role: 'pharmacist', storeId: '' });
      } catch (e: any) { alert(e.message); }
  };

  const filtered = users.filter(u => {
      const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = filterRole === 'all' || u.role === filterRole;
      return matchSearch && matchRole;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl mx-auto">
      
      <div className="flex justify-between items-end mb-8">
          <div>
              <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3"><Users size={24} className="text-blue-500" /> Identity & Access</h2>
              <p className="text-slate-400 text-sm">Manage system access, roles, and branch assignments.</p>
          </div>
          <button onClick={() => setIsAdding(!isAdding)} className="glass-button-primary px-6 inline-flex items-center gap-2">
              <UserPlus size={16} /> Enroll User
          </button>
      </div>

      <AnimatePresence>
          {isAdding && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <form onSubmit={handleAddUser} className="glass-panel p-6 mb-8 border border-blue-500/20 bg-blue-500/5">
                      <h3 className="font-bold text-blue-400 mb-6 uppercase tracking-widest text-xs">User Enrollment Profile</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Full Name</label>
                              <input type="text" required className="glass-input w-full py-3 text-sm" placeholder="Dr. XYZ" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Email / Username</label>
                              <input type="email" required className="glass-input w-full py-3 text-sm" placeholder="xyz@hospital.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">System Role</label>
                              <select className="glass-input w-full py-3 text-sm" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                                  <option value="pharmacist">Pharmacist</option>
                                  <option value="manager">Manager</option>
                                  <option value="admin">Admin</option>
                              </select>
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Assigned Primary Node</label>
                              <select className="glass-input w-full py-3 text-sm" value={formData.storeId} onChange={e => setFormData({...formData, storeId: e.target.value})}>
                                  <option value="">No specific node (Floating)</option>
                                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                          </div>
                      </div>
                      <div className="flex justify-end mt-6 gap-4">
                          <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 font-bold text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                          <button type="submit" className="glass-button-primary px-8">Provision Access</button>
                      </div>
                  </form>
              </motion.div>
          )}
      </AnimatePresence>

      <div className="glass-panel overflow-hidden">
          <div className="p-4 border-b border-white/5 flex flex-wrap gap-4 items-center justify-between">
               <div className="flex gap-2 p-1 glass-input border border-white/5 w-fit">
                   <button onClick={() => setFilterRole('all')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${filterRole === 'all' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>All Roles</button>
                   <button onClick={() => setFilterRole('admin')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${filterRole === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}>Admins</button>
                   <button onClick={() => setFilterRole('manager')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${filterRole === 'manager' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>Managers</button>
                   <button onClick={() => setFilterRole('pharmacist')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${filterRole === 'pharmacist' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>Pharmacists</button>
               </div>
               
               <div className="relative w-64">
                   <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                   <input type="text" placeholder="Search identities..." className="glass-input w-full pl-9 py-2 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
               </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left">
                  <thead>
                      <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/5">
                          <th className="py-4 pl-6 pr-4">Identity</th>
                          <th className="py-4 px-4">Role Clearance</th>
                          <th className="py-4 px-4">Assigned Node</th>
                          <th className="py-4 px-4 text-center">Status</th>
                          <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                      {filtered.map(user => {
                          const userStore = stores.find(s => s.id === user.storeId);
                          return (
                              <tr key={user.uid} className="hover:bg-white/5 transition-colors group">
                                  <td className="py-4 pl-6 pr-4">
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold text-slate-300 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                                              {user.name.charAt(0)}
                                          </div>
                                          <div>
                                              <p className="font-bold text-sm text-white">{user.name}</p>
                                              <p className="text-xs text-slate-500 font-mono">{user.email}</p>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="py-4 px-4">
                                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                                          user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                          user.role === 'manager' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      }`}>
                                          {user.role === 'admin' && <Shield size={10}/>} {user.role}
                                      </span>
                                  </td>
                                  <td className="py-4 px-4 text-xs font-mono text-slate-400">
                                      {user.role === 'admin' ? 'Global Access' : (userStore?.name || 'Floating')}
                                  </td>
                                  <td className="py-4 px-4 text-center">
                                      {user.isActive ? (
                                          <CheckCircle2 size={16} className="text-emerald-500 mx-auto"/>
                                      ) : (
                                          <XCircle size={16} className="text-red-500 mx-auto"/>
                                      )}
                                  </td>
                                  <td className="py-4 px-6 text-right">
                                      <button className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-widest px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded transition-colors">Manage</button>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </div>
    </motion.div>
  );
}
