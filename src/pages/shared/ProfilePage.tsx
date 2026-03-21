import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Store } from '../../types';
import {
  User, Mail, Phone, Building2, Save,
  Plus, X, CheckCircle2, AlertTriangle, Edit2,
  Shield, MapPin, Clock, AtSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

const roleBadge: Record<string, { label: string; color: string }> = {
  pharmacist: { label: 'Pharmacist',    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' },
  manager:    { label: 'Store Manager', color: 'bg-blue-500/20 text-blue-400 border-blue-500/20'         },
  admin:      { label: 'Administrator', color: 'bg-purple-500/20 text-purple-400 border-purple-500/20'   },
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function StatusBtn({ status, onClick, disabled, label = 'Save Changes' }: {
  status: SaveStatus; onClick: () => void; disabled?: boolean; label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || status === 'saving'}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 ${
        status === 'saved'  ? 'bg-emerald-600 text-white' :
        status === 'error'  ? 'bg-red-600 text-white' :
        status === 'saving' ? 'bg-blue-600/60 text-white' :
                              'bg-blue-600 text-white hover:bg-blue-500'
      }`}
    >
      {status === 'saving' ? (
        <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
      ) : status === 'saved' ? (
        <><CheckCircle2 size={15} /> Saved!</>
      ) : status === 'error' ? (
        <><AlertTriangle size={15} /> Failed</>
      ) : (
        <><Save size={15} /> {label}</>
      )}
    </button>
  );
}

export function ProfilePage() {
  const { profile, stores, currentStore, refreshProfile } = useAuth();

  // Personal form
  const [name, setName]               = useState('');
  const [phone, setPhone]             = useState('');
  const [designation, setDesignation] = useState('');
  const [bio, setBio]                 = useState('');
  const [profileStatus, setProfileStatus] = useState<SaveStatus>('idle');

  // Store edit
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [storeName, setStoreName]         = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [hospitalName, setHospitalName]   = useState('');
  const [storeContact, setStoreContact]   = useState('');
  const [storeStatus, setStoreStatus]     = useState<SaveStatus>('idle');

  // Alternate emails
  const [altEmails, setAltEmails]           = useState<string[]>([]);
  const [newEmail, setNewEmail]             = useState('');
  const [emailError, setEmailError]         = useState('');
  const [emailStatus, setEmailStatus]       = useState<SaveStatus>('idle');

  useEffect(() => {
    if (!profile) return;
    setName(profile.name || '');
    setPhone(profile.phone || '');
    setDesignation(profile.designation || '');
    setBio(profile.bio || '');
    setAltEmails(profile.alternateEmails || []);
  }, [profile]);

  const openStoreEdit = (store: Store) => {
    setEditingStoreId(store.id);
    setStoreName(store.name || '');
    setStoreLocation(store.location || '');
    setHospitalName((store as any).hospitalName || '');
    setStoreContact(store.contact || '');
    setStoreStatus('idle');
  };

  // ── Save personal profile ────────────────────────────────
  const saveProfile = async () => {
    if (!profile || !name.trim()) return;
    setProfileStatus('saving');
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        name: name.trim(), phone: phone.trim(),
        designation: designation.trim(), bio: bio.trim(),
        updatedAt: new Date().toISOString(),
      });
      await refreshProfile();
      setProfileStatus('saved');
      setTimeout(() => setProfileStatus('idle'), 2500);
    } catch { setProfileStatus('error'); setTimeout(() => setProfileStatus('idle'), 2500); }
  };

  // ── Save store info ──────────────────────────────────────
  const saveStore = async () => {
    if (!editingStoreId || !storeName.trim()) return;
    setStoreStatus('saving');
    try {
      await updateDoc(doc(db, 'stores', editingStoreId), {
        name: storeName.trim(), location: storeLocation.trim(),
        hospitalName: hospitalName.trim(), contact: storeContact.trim(),
      });
      setStoreStatus('saved');
      setTimeout(() => { setStoreStatus('idle'); setEditingStoreId(null); }, 1500);
    } catch { setStoreStatus('error'); setTimeout(() => setStoreStatus('idle'), 2500); }
  };

  // ── Add alternate email ──────────────────────────────────
  const addEmail = async () => {
    setEmailError('');
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (!isValidEmail(trimmed))                        { setEmailError('Enter a valid email address'); return; }
    if (trimmed === profile?.email.toLowerCase())      { setEmailError('This is already your login email'); return; }
    if (altEmails.map(e => e.toLowerCase()).includes(trimmed)) { setEmailError('Already in your list'); return; }
    if (altEmails.length >= 5)                         { setEmailError('Maximum 5 alternate emails allowed'); return; }

    const updated = [...altEmails, trimmed];
    setEmailStatus('saving');
    try {
      await updateDoc(doc(db, 'users', profile!.uid), {
        alternateEmails: updated, updatedAt: new Date().toISOString(),
      });
      setAltEmails(updated);
      setNewEmail('');
      await refreshProfile();
      setEmailStatus('saved');
      setTimeout(() => setEmailStatus('idle'), 1800);
    } catch { setEmailStatus('error'); setTimeout(() => setEmailStatus('idle'), 2500); }
  };

  // ── Remove alternate email ───────────────────────────────
  const removeEmail = async (email: string) => {
    const updated = altEmails.filter(e => e !== email);
    setEmailStatus('saving');
    try {
      await updateDoc(doc(db, 'users', profile!.uid), {
        alternateEmails: updated, updatedAt: new Date().toISOString(),
      });
      setAltEmails(updated);
      await refreshProfile();
      setEmailStatus('saved');
      setTimeout(() => setEmailStatus('idle'), 1500);
    } catch { setEmailStatus('error'); setTimeout(() => setEmailStatus('idle'), 2500); }
  };

  if (!profile) return null;

  const badge = roleBadge[profile.role];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-5">

      {/* ── Header card ──────────────────────────────────── */}
      <div className="glass-panel p-5 flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/30 to-blue-600/20 border border-blue-500/20 flex items-center justify-center text-blue-300 font-black text-2xl shrink-0">
          {profile.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white leading-tight">{profile.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{profile.email}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-widest ${badge.color}`}>
              {badge.label}
            </span>
            {profile.designation && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                {profile.designation}
              </span>
            )}
            {altEmails.length > 0 && (
              <span className="text-[10px] text-slate-600 font-mono flex items-center gap-1">
                <AtSign size={9} /> {altEmails.length} alt email{altEmails.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Personal Information ─────────────────────────── */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-5">
          <User size={15} className="text-blue-400" />
          <h3 className="font-bold text-white text-sm">Personal Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="field-label">Full Name *</label>
            <input type="text" className="glass-input w-full py-2.5 text-sm" value={name}
              onChange={e => setName(e.target.value)} placeholder="Your full name" />
          </div>
          <div>
            <label className="field-label">Phone / Mobile</label>
            <input type="tel" className="glass-input w-full py-2.5 text-sm" value={phone}
              onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="field-label">Designation / Title</label>
            <input type="text" className="glass-input w-full py-2.5 text-sm" value={designation}
              onChange={e => setDesignation(e.target.value)}
              placeholder={profile.role === 'pharmacist' ? 'e.g. Senior Pharmacist' : profile.role === 'manager' ? 'e.g. Pharmacy In-Charge' : 'e.g. Chief Pharmacist'} />
          </div>
          <div>
            <label className="field-label">Login Email (read-only)</label>
            <div className="glass-input w-full py-2.5 text-sm text-slate-500 border-dashed select-none flex items-center gap-2">
              <Mail size={13} className="shrink-0" />{profile.email}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="field-label">Bio / Notes</label>
          <textarea className="glass-input w-full py-2.5 text-sm resize-none h-16" value={bio}
            onChange={e => setBio(e.target.value)} placeholder="Short bio or role description..." />
        </div>

        <div className="flex justify-end">
          <StatusBtn status={profileStatus} onClick={saveProfile} disabled={!name.trim()} />
        </div>
      </div>

      {/* ── Alternate Emails ────────────────────────────── */}
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <AtSign size={15} className="text-blue-400" />
            <h3 className="font-bold text-white text-sm">Alternate Contact Emails</h3>
          </div>
          {/* status indicator */}
          {emailStatus === 'saving' && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <div className="w-3 h-3 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" /> Saving…
            </div>
          )}
          {emailStatus === 'saved' && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
              <CheckCircle2 size={11} /> Saved
            </div>
          )}
          {emailStatus === 'error' && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-bold">
              <AlertTriangle size={11} /> Error
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Add up to <span className="text-white font-bold">5 alternate email addresses</span>. These are stored on your account for notifications and future use — separate from your login credentials.
        </p>

        {/* List */}
        <div className="space-y-2 mb-4">
          {altEmails.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-white/8 rounded-2xl">
              <AtSign size={22} className="mx-auto mb-2 text-slate-700" />
              <p className="text-sm text-slate-600 font-bold">No alternate emails added</p>
              <p className="text-xs text-slate-700 mt-0.5">Add one below</p>
            </div>
          ) : (
            <AnimatePresence>
              {altEmails.map((email, idx) => (
                <motion.div
                  key={email}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  className="flex items-center gap-3 px-3.5 py-2.5 bg-white/5 border border-white/8 rounded-xl group"
                >
                  {/* Index pill */}
                  <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-blue-400">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-white truncate">{email}</p>
                    <p className="text-[10px] text-slate-600">Alternate contact</p>
                  </div>
                  <button
                    onClick={() => removeEmail(email)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    <X size={13} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Add input */}
        {altEmails.length < 5 ? (
          <div>
            <label className="field-label">Add New Email</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  className={`glass-input w-full pl-9 py-2.5 text-sm ${emailError ? 'border-red-500/40' : ''}`}
                  placeholder="alternate@example.com"
                  value={newEmail}
                  onChange={e => { setNewEmail(e.target.value); setEmailError(''); }}
                  onKeyDown={e => e.key === 'Enter' && addEmail()}
                />
              </div>
              <button
                onClick={addEmail}
                disabled={!newEmail.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-30 shrink-0"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            {emailError ? (
              <p className="text-xs text-red-400 font-bold mt-1.5 flex items-center gap-1">
                <AlertTriangle size={10} /> {emailError}
              </p>
            ) : (
              <p className="text-[10px] text-slate-700 mt-1.5">
                {5 - altEmails.length} slot{5 - altEmails.length !== 1 ? 's' : ''} remaining · Press Enter to add
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 font-bold">
            <AlertTriangle size={12} /> Maximum of 5 alternate emails reached. Remove one to add another.
          </div>
        )}
      </div>

      {/* ── Store info (manager + admin can edit) ──────────── */}
      {(profile.role === 'manager' || profile.role === 'admin') && stores.length > 0 && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-blue-400" />
            <h3 className="font-bold text-white text-sm">
              {profile.role === 'manager' ? 'My Stores' : 'All Stores'}
            </h3>
            <span className="text-[10px] text-slate-600 font-mono">{stores.length} store{stores.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-3">
            {stores.map(store => (
              <div key={store.id} className={`rounded-2xl border transition-all overflow-hidden ${
                editingStoreId === store.id ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/8 bg-white/3'
              }`}>
                {/* Store header */}
                <div className="flex items-start justify-between gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm">{store.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><MapPin size={10} />{store.location}</p>
                    {(store as any).hospitalName && <p className="text-[10px] text-slate-600 mt-0.5">{(store as any).hospitalName}</p>}
                    {store.contact && <p className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1"><Phone size={9} /> {store.contact}</p>}
                  </div>
                  <button
                    onClick={() => editingStoreId === store.id ? setEditingStoreId(null) : openStoreEdit(store)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all shrink-0"
                  >
                    <Edit2 size={11} />
                    {editingStoreId === store.id ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {/* Inline edit */}
                <AnimatePresence>
                  {editingStoreId === store.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-3 mt-0 pt-4">
                        <div><label className="field-label">Store Name</label><input type="text" className="glass-input w-full py-2 text-sm" value={storeName} onChange={e => setStoreName(e.target.value)} /></div>
                        <div><label className="field-label">Hospital / Institution</label><input type="text" className="glass-input w-full py-2 text-sm" value={hospitalName} onChange={e => setHospitalName(e.target.value)} /></div>
                        <div><label className="field-label">Location / Address</label><input type="text" className="glass-input w-full py-2 text-sm" value={storeLocation} onChange={e => setStoreLocation(e.target.value)} /></div>
                        <div><label className="field-label">Contact Number</label><input type="text" className="glass-input w-full py-2 text-sm" value={storeContact} onChange={e => setStoreContact(e.target.value)} /></div>
                        <div className="md:col-span-2 flex justify-end">
                          <StatusBtn status={storeStatus} onClick={saveStore} disabled={!storeName.trim()} label="Save Store" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pharmacist: assigned store (read-only) ──────────── */}
      {profile.role === 'pharmacist' && currentStore && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-blue-400" />
            <h3 className="font-bold text-white text-sm">My Assigned Store</h3>
          </div>
          <div className="p-4 bg-white/3 border border-white/8 rounded-2xl space-y-1.5">
            <p className="font-bold text-white">{currentStore.name}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1.5"><MapPin size={11} />{currentStore.location}</p>
            {(currentStore as any).hospitalName && <p className="text-xs text-slate-400 flex items-center gap-1.5"><Building2 size={11} />{(currentStore as any).hospitalName}</p>}
            {currentStore.contact && <p className="text-xs text-slate-400 flex items-center gap-1.5"><Phone size={11} />{currentStore.contact}</p>}
            <p className="text-[10px] text-slate-600 pt-1 italic">Store details are managed by your store manager.</p>
          </div>
        </div>
      )}

      {/* ── Account summary ─────────────────────────────────── */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={15} className="text-blue-400" />
          <h3 className="font-bold text-white text-sm">Account Summary</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Account ID',   value: profile.uid.slice(0, 14) + '…', mono: true },
            { label: 'Role',         value: badge.label },
            { label: 'Status',       value: profile.isActive ? 'Active' : 'Inactive', color: profile.isActive ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Member Since', value: profile.createdAt ? format(new Date(profile.createdAt), 'dd MMM yyyy') : '—' },
            { label: 'Last Updated', value: profile.updatedAt ? format(new Date(profile.updatedAt), 'dd MMM yyyy, HH:mm') : 'Never' },
            { label: 'Alt. Emails',  value: `${altEmails.length} / 5` },
          ].map(({ label, value, mono, color }) => (
            <div key={label} className="bg-white/3 rounded-xl p-3 border border-white/5">
              <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-1">{label}</p>
              <p className={`text-sm font-bold truncate ${color ?? 'text-slate-300'} ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
