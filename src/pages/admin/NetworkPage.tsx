import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Store, UserProfile } from '../../types';
import {
  Server, Plus, Search, MapPin, Building2, Phone,
  Edit2, Trash2, CheckCircle2, X, Save, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { writeAudit } from '../../services/auditService';
import { useAuth } from '../../contexts/AuthContext';

const EMPTY_FORM = { name: '', location: '', hospitalName: '', contact: '', managerId: '' };

export function NetworkPage() {
  const { profile } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'stores'), s =>
      setStores(s.docs.map(d => ({ id: d.id, ...d.data() } as Store)))
    );
    const u2 = onSnapshot(collection(db, 'users'), s =>
      setUsers(s.docs.map(d => ({ uid: d.id, ...d.data() } as unknown as UserProfile))
    ));
    return () => { u1(); u2(); };
  }, []);

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, 'stores'), {
        ...formData, createdAt: new Date().toISOString(),
      });
      await writeAudit(profile.email, ref.id, 'CREATE_STORE', 'store', ref.id, formData);
      setIsAdding(false);
      setFormData({ ...EMPTY_FORM });
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const startEdit = (store: Store) => {
    setEditingId(store.id);
    setFormData({
      name: store.name, location: store.location,
      hospitalName: store.hospitalName, contact: store.contact,
      managerId: store.managerId,
    });
    setIsAdding(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !profile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'stores', editingId), { ...formData });
      await writeAudit(profile.email, editingId, 'UPDATE_STORE', 'store', editingId, formData);
      setEditingId(null);
      setFormData({ ...EMPTY_FORM });
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (storeId: string) => {
    if (!profile) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'stores', storeId));
      await writeAudit(profile.email, storeId, 'DELETE_STORE', 'store', storeId, {});
      setConfirmDelete(null);
    } catch (e: any) { alert(e.message); }
    finally { setDeleting(false); }
  };

  const filteredStores = stores.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.hospitalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeForm = isAdding || editingId !== null;
  const isEditMode = editingId !== null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl mx-auto">

      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
            <Server size={24} className="text-blue-500" /> Network Nodes
          </h2>
          <p className="text-slate-400 text-sm">Manage hospital pharmacy branches. Full CRUD.</p>
        </div>
        <button
          onClick={() => { setIsAdding(v => !v); setEditingId(null); setFormData({ ...EMPTY_FORM }); }}
          className="glass-button-primary px-6 inline-flex items-center gap-2"
        >
          <Plus size={16} /> Deploy New Node
        </button>
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-panel p-6 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div>
                  <p className="font-bold text-white">Delete Store?</p>
                  <p className="text-xs text-slate-400">This permanently removes the store record.</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-6">
                Medicines, batches, and orders linked to this store will remain but lose their store reference.
                This action is audited but not reversible.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 glass-button-secondary text-sm">Cancel</button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Store'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create / Edit form */}
      <AnimatePresence>
        {activeForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <form onSubmit={isEditMode ? handleUpdate : handleCreate} className="glass-panel p-6 border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-blue-400 uppercase tracking-widest text-xs">
                  {isEditMode ? 'Edit Store Node' : 'New Store Node Configuration'}
                </h3>
                <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); setFormData({ ...EMPTY_FORM }); }}
                  className="text-slate-500 hover:text-white transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'Pharmacy Sub-Name', key: 'name', placeholder: 'Main OPD Pharmacy' },
                  { label: 'Hospital / Institution', key: 'hospitalName', placeholder: 'Safdarjung Hospital' },
                  { label: 'Location / City', key: 'location', placeholder: 'New Delhi' },
                  { label: 'Contact Info', key: 'contact', placeholder: '+91 XXXX XXXXXX' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{label}</label>
                    <input type="text" required className="glass-input w-full py-2.5 text-sm" placeholder={placeholder}
                      value={(formData as any)[key]}
                      onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Assigned Manager</label>
                  <select required className="glass-input w-full py-2.5 text-sm"
                    value={formData.managerId}
                    onChange={e => setFormData(prev => ({ ...prev, managerId: e.target.value }))}>
                    <option value="">Select a Manager...</option>
                    {managers.map(m => <option key={m.uid} value={m.uid}>{m.name} ({m.email})</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end mt-5 gap-3">
                <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); setFormData({ ...EMPTY_FORM }); }}
                  className="px-5 py-2.5 text-sm text-slate-400 hover:text-white transition-colors font-bold">Cancel</button>
                <button type="submit" disabled={saving} className="glass-button-primary px-6 py-2.5 flex items-center gap-2 disabled:opacity-50">
                  <Save size={14} />
                  {saving ? 'Saving...' : isEditMode ? 'Update Store' : 'Initialize Node'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input type="text" placeholder="Filter nodes..." className="glass-input w-full pl-10 py-2.5 text-sm"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {/* Store cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
          {filteredStores.map(store => {
            const manager = users.find(u => u.uid === store.managerId);
            const isEditing = editingId === store.id;
            return (
              <div key={store.id}
                className={`bg-navy-900 border rounded-2xl p-5 transition-all ${isEditing ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/5 hover:border-white/15'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-base truncate">{store.name}</h3>
                    <p className="text-xs text-blue-400 font-bold mt-0.5 flex items-center gap-1">
                      <Building2 size={11} />{store.hospitalName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => isEditing ? (setEditingId(null), setFormData({ ...EMPTY_FORM })) : startEdit(store)}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-colors"
                      title="Edit store"
                    >
                      {isEditing ? <X size={14} /> : <Edit2 size={14} />}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(store.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                      title="Delete store"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin size={12} className="text-slate-500 shrink-0" /> {store.location}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Phone size={12} className="text-slate-500 shrink-0" /> {store.contact}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/5 p-2 rounded-lg mt-2">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {manager?.name?.charAt(0) || '?'}
                    </div>
                    <span className="text-white font-bold">{manager?.name || 'Unassigned'}</span>
                    <span className="text-slate-600 text-[10px]">· {manager?.email}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] font-mono text-slate-600">{store.id.slice(0, 12)}...</span>
                  <span className="bg-emerald-500/10 text-emerald-400 text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Online
                  </span>
                </div>
              </div>
            );
          })}

          {filteredStores.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-500">
              <Server size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-white">No stores found</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
