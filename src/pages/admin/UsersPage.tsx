import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, updateDoc, doc, query, where, getDocs
} from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile, Store } from '../../types';
import {
  Users, Filter, Shield, CheckCircle2, XCircle,
  Edit2, X, Save, Mail, Phone, Building2, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { writeAudit } from '../../services/auditService';
import { useAuth } from '../../contexts/AuthContext';

export function UsersPage() {
  const { profile: adminProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Edit modal
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', phone: '', designation: '', storeId: '', isActive: true, role: 'pharmacist',
  });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'users'), s =>
      setUsers(s.docs.map(d => ({ uid: d.id, ...d.data() } as unknown as UserProfile)))
    );
    const u2 = onSnapshot(collection(db, 'stores'), s =>
      setStores(s.docs.map(d => ({ id: d.id, ...d.data() } as Store)))
    );
    return () => { u1(); u2(); };
  }, []);

  const openEdit = (user: UserProfile) => {
    setEditingUser(user);
    setEditForm({
      name:        user.name,
      phone:       user.phone ?? '',
      designation: user.designation ?? '',
      storeId:     user.storeId ?? '',
      isActive:    user.isActive,
      role:        user.role,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !adminProfile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        name:        editForm.name,
        phone:       editForm.phone,
        designation: editForm.designation,
        storeId:     editForm.storeId || null,
        isActive:    editForm.isActive,
        role:        editForm.role,
        updatedAt:   new Date().toISOString(),
      });
      await writeAudit(adminProfile.email, editingUser.storeId ?? 'global', 'UPDATE_USER', 'user', editingUser.uid, {
        changed: { name: editForm.name, role: editForm.role, isActive: editForm.isActive, storeId: editForm.storeId },
      });
      setSuccessMsg('User updated.');
      setTimeout(() => { setSuccessMsg(''); setEditingUser(null); }, 1500);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (user: UserProfile) => {
    if (!adminProfile) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { isActive: !user.isActive });
      await writeAudit(adminProfile.email, user.storeId ?? 'global', user.isActive ? 'DEACTIVATE_USER' : 'ACTIVATE_USER', 'user', user.uid, { email: user.email });
    } catch (e: any) { alert(e.message); }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl mx-auto">

      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
            <Users size={24} className="text-blue-500" /> Identity & Access
          </h2>
          <p className="text-slate-400 text-sm">
            Manage roles, store assignments and activation status. Users are created via Firebase Authentication.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 rounded-xl text-xs text-blue-300"
        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <Shield size={13} className="text-blue-400 shrink-0 mt-0.5" />
        <span>
          New users are created by signing up through the Login page (Firebase Auth), which automatically creates
          their Firestore profile. Use this panel to edit roles, store assignments, and activate/deactivate access.
        </span>
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => !saving && setEditingUser(null)}
          >
            <motion.div
              initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
              className="glass-panel p-6 w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-white">Edit User Profile</h3>
                  <p className="text-xs text-slate-500 font-mono">{editingUser.email}</p>
                </div>
                <button onClick={() => setEditingUser(null)} className="text-slate-500 hover:text-white p-1">
                  <X size={16} />
                </button>
              </div>

              {successMsg && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-bold">
                  <CheckCircle2 size={14} /> {successMsg}
                </div>
              )}

              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Full Name</label>
                    <input type="text" required className="glass-input w-full py-2.5 text-sm"
                      value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Phone</label>
                    <input type="tel" className="glass-input w-full py-2.5 text-sm" placeholder="+91..."
                      value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Role</label>
                    <select className="glass-input w-full py-2.5 text-sm"
                      value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}>
                      <option value="pharmacist">Pharmacist</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Assigned Store</label>
                    <select className="glass-input w-full py-2.5 text-sm"
                      value={editForm.storeId} onChange={e => setEditForm(p => ({ ...p, storeId: e.target.value }))}>
                      <option value="">No store (floating)</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Designation</label>
                    <input type="text" className="glass-input w-full py-2.5 text-sm" placeholder="e.g. Senior Pharmacist"
                      value={editForm.designation} onChange={e => setEditForm(p => ({ ...p, designation: e.target.value }))} />
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div>
                    <p className="text-sm font-bold text-white">Account Active</p>
                    <p className="text-xs text-slate-500">Inactive users cannot log in</p>
                  </div>
                  <button type="button"
                    onClick={() => setEditForm(p => ({ ...p, isActive: !p.isActive }))}
                    className={`w-12 h-6 rounded-full transition-all relative ${editForm.isActive ? 'bg-emerald-500' : 'bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${editForm.isActive ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingUser(null)}
                    className="flex-1 py-2.5 glass-button-secondary text-sm">Cancel</button>
                  <button type="submit" disabled={saving}
                    className="flex-1 glass-button-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    <Save size={13} />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/5 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-1 p-1 glass-input border border-white/5 w-fit">
            {(['all', 'admin', 'manager', 'pharmacist'] as const).map(role => (
              <button key={role} onClick={() => setFilterRole(role)}
                className={`px-4 py-1.5 rounded text-xs font-bold transition-all capitalize ${
                  filterRole === role
                    ? role === 'admin' ? 'bg-purple-500/20 text-purple-400'
                      : role === 'manager' ? 'bg-blue-500/20 text-blue-400'
                      : role === 'pharmacist' ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}>
                {role === 'all' ? 'All Roles' : role}
              </button>
            ))}
          </div>
          <div className="relative w-64">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input type="text" placeholder="Search identities..."
              className="glass-input w-full pl-9 py-2 text-sm"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/5">
                <th className="py-4 pl-6 pr-4">Identity</th>
                <th className="py-4 px-4">Role</th>
                <th className="py-4 px-4">Assigned Store</th>
                <th className="py-4 px-4">Contact</th>
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
                        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center font-bold text-slate-300 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors shrink-0">
                          {user.name?.charAt(0) ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">{user.name}</p>
                          <p className="text-xs text-slate-500 font-mono truncate">{user.email}</p>
                          {user.designation && (
                            <p className="text-[10px] text-slate-600 truncate">{user.designation}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                        user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : user.role === 'manager' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {user.role === 'admin' && <Shield size={9} />} {user.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-400">
                      {user.role === 'admin' ? (
                        <span className="text-purple-400">Global Access</span>
                      ) : userStore ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 size={11} className="text-blue-400 shrink-0" />
                          <span className="truncate max-w-[120px]">{userStore.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">Floating</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {user.phone && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Phone size={11} className="text-slate-600" /> {user.phone}
                        </div>
                      )}
                      {user.alternateEmails && user.alternateEmails.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-600 mt-0.5">
                          <Mail size={10} /> {user.alternateEmails.length} alt email{user.alternateEmails.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button onClick={() => toggleActive(user)}
                        className="group/toggle inline-flex items-center gap-1.5 text-xs font-bold transition-colors"
                        title={user.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {user.isActive ? (
                          <CheckCircle2 size={16} className="text-emerald-500 group-hover/toggle:text-amber-400 transition-colors" />
                        ) : (
                          <XCircle size={16} className="text-red-500 group-hover/toggle:text-emerald-400 transition-colors" />
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => openEdit(user)}
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-widest px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded transition-colors"
                      >
                        <Edit2 size={11} /> Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-500">
                    <Users size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-bold">No users found</p>
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
