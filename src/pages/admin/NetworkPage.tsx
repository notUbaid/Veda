import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Store, UserProfile } from '../../types';
import { Server, Plus, Search, MapPin, Building2, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function NetworkPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Form
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', location: '', hospitalName: '', contact: '', managerId: '' });

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'stores'), s => setStores(s.docs.map(d => ({ id: d.id, ...d.data() } as Store))));
    const unsub2 = onSnapshot(collection(db, 'users'), s => setUsers(s.docs.map(d => ({ uid: d.id, ...d.data() } as unknown as UserProfile))));
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleAddStore = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await addDoc(collection(db, 'stores'), {
              ...formData,
              createdAt: new Date().toISOString()
          });
          setIsAdding(false);
          setFormData({ name: '', location: '', hospitalName: '', contact: '', managerId: '' });
      } catch (e: any) { alert(e.message); }
  };

  const filteredStores = stores.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.hospitalName.toLowerCase().includes(searchQuery.toLowerCase()));
  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl mx-auto">
      
      <div className="flex justify-between items-end mb-8">
          <div>
              <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3"><Server size={24} className="text-blue-500" /> Network Nodes</h2>
              <p className="text-slate-400 text-sm">Manage interconnected hospital pharmacy branches.</p>
          </div>
          <button onClick={() => setIsAdding(!isAdding)} className="glass-button-primary px-6 inline-flex items-center gap-2">
              <Plus size={16} /> Deploy New Node
          </button>
      </div>

      <AnimatePresence>
          {isAdding && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <form onSubmit={handleAddStore} className="glass-panel p-6 mb-8 border border-blue-500/20 bg-blue-500/5">
                      <h3 className="font-bold text-blue-400 mb-6 uppercase tracking-widest text-xs">Node Configuration</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Pharmacy Sub-Name</label>
                              <input type="text" required className="glass-input w-full py-3 text-sm" placeholder="Main OPD Pharmacy" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Hospital / Institution</label>
                              <input type="text" required className="glass-input w-full py-3 text-sm" placeholder="Safdarjung Hospital" value={formData.hospitalName} onChange={e => setFormData({...formData, hospitalName: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Location / City</label>
                              <input type="text" required className="glass-input w-full py-3 text-sm" placeholder="New Delhi" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Contact Info</label>
                              <input type="text" required className="glass-input w-full py-3 text-sm" placeholder="+91 XXXX" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} />
                          </div>
                          <div className="lg:col-span-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Assigned Store Manager</label>
                              <select required className="glass-input w-full py-3 text-sm" value={formData.managerId} onChange={e => setFormData({...formData, managerId: e.target.value})}>
                                  <option value="">Select a Manager Profile...</option>
                                  {managers.map(m => <option key={m.uid} value={m.uid}>{m.name} ({m.email})</option>)}
                              </select>
                          </div>
                      </div>
                      <div className="flex justify-end mt-6 gap-4">
                          <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 font-bold text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                          <button type="submit" className="glass-button-primary px-8">Initialize Node</button>
                      </div>
                  </form>
              </motion.div>
          )}
      </AnimatePresence>

      <div className="glass-panel overflow-hidden">
          <div className="p-4 border-b border-white/5">
               <div className="relative w-72">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                   <input type="text" placeholder="Filter nodes..." className="glass-input w-full pl-10 py-2.5 text-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
               </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1 p-6 bg-black/20">
              {filteredStores.map(store => {
                  const manager = users.find(u => u.uid === store.managerId);
                  return (
                      <div key={store.id} className="bg-navy-900 border border-white/5 rounded-2xl p-5 hover:border-blue-500/30 transition-colors ios-shadow">
                           <div className="flex justify-between items-start mb-4">
                                <div>
                                     <h3 className="font-bold text-white text-base">{store.name}</h3>
                                     <p className="text-xs text-blue-400 font-bold mt-1 inline-flex items-center gap-1"><Building2 size={12}/>{store.hospitalName}</p>
                                </div>
                                <span className="bg-emerald-500/10 text-emerald-400 text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">Online</span>
                           </div>

                           <div className="space-y-2 mt-6">
                               <div className="flex items-center gap-3 text-xs text-slate-400">
                                   <MapPin size={14} className="text-slate-500"/> {store.location}
                               </div>
                               <div className="flex items-center gap-3 text-xs text-slate-400">
                                   <Phone size={14} className="text-slate-500"/> {store.contact}
                               </div>
                               <div className="flex items-center gap-3 text-xs text-slate-400 bg-white/5 p-2 rounded-lg mt-2">
                                   <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px]">{manager?.name.charAt(0) || '?'}</div>
                                   MGR: <span className="text-white font-bold">{manager?.name || 'Unassigned'}</span>
                               </div>
                           </div>
                      </div>
                  );
              })}
          </div>
      </div>

    </motion.div>
  );
}
