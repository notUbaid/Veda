import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, Plus, Trash2,
  Save, CheckCircle2, AlertCircle, Bell, Shield
} from 'lucide-react';

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();

  const [name, setName]           = useState(profile?.name ?? '');
  const [phone, setPhone]         = useState(profile?.phone ?? '');
  const [designation, setDesig]   = useState(profile?.designation ?? '');
  const [altEmails, setAltEmails] = useState<string[]>(profile?.alternateEmails ?? []);
  const [newEmail, setNewEmail]   = useState('');

  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  const addAltEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes('@')) { setError('Enter a valid email.'); return; }
    if (altEmails.includes(trimmed))        { setError('Already added.');        return; }
    if (altEmails.length >= 5)              { setError('Maximum 5 alternate emails.'); return; }
    setAltEmails(prev => [...prev, trimmed]);
    setNewEmail('');
    setError('');
  };

  const removeAltEmail = (email: string) =>
    setAltEmails(prev => prev.filter(e => e !== email));

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        name,
        phone,
        designation,
        alternateEmails: altEmails,
        updatedAt: new Date().toISOString(),
      });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const roleColor: Record<string, string> = {
    admin:      'text-purple-400 bg-purple-500/10 border-purple-500/20',
    manager:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
    pharmacist: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-5">

      {/* Avatar + role */}
      <div className="glass-panel p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-2xl shrink-0">
          {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white truncate">{profile?.name}</h2>
          <p className="text-sm text-slate-400 font-mono">{profile?.email}</p>
          <span className={`inline-flex items-center gap-1.5 mt-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${roleColor[profile?.role ?? 'pharmacist']}`}>
            <Shield size={10} /> {profile?.role}
          </span>
        </div>
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Member since</p>
          <p className="text-sm text-slate-300 font-mono">
            {profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—'}
          </p>
        </div>
      </div>

      {/* Profile fields */}
      <div className="glass-panel p-6 space-y-5">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-widest">
          <User size={15} className="text-blue-400" /> Profile Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Full Name</label>
            <input type="text" className="glass-input w-full py-2.5 text-sm"
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Phone</label>
            <input type="tel" className="glass-input w-full py-2.5 text-sm" placeholder="+91 98765 43210"
              value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Designation</label>
            <input type="text" className="glass-input w-full py-2.5 text-sm"
              placeholder="e.g. Senior Pharmacist, Store Manager"
              value={designation} onChange={e => setDesig(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Email notifications */}
      <div className="glass-panel p-6 space-y-5">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-widest">
            <Bell size={15} className="text-blue-400" /> Email Notifications
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Alerts, order updates, dispense confirmations and waste records are sent to all addresses below.
          </p>
        </div>

        {/* Primary — read only */}
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
            Primary Email (Login)
          </label>
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Mail size={14} className="text-blue-400 shrink-0" />
            <span className="text-sm text-slate-300 font-mono flex-1 truncate">{profile?.email}</span>
            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Always active
            </span>
          </div>
        </div>

        {/* Alternate emails */}
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
            Alternate Emails ({altEmails.length}/5)
          </label>

          <AnimatePresence>
            {altEmails.map(email => (
              <motion.div key={email}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-2 group"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <Mail size={13} className="text-slate-500 shrink-0" />
                <span className="text-sm text-slate-300 font-mono flex-1 truncate">{email}</span>
                <button onClick={() => removeAltEmail(email)}
                  className="p-1 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 size={13} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {altEmails.length < 5 && (
            <div className="flex gap-2 mt-2">
              <input type="email"
                className="glass-input flex-1 py-2.5 text-sm"
                placeholder="alternate@email.com"
                value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAltEmail(); } }}
              />
              <button onClick={addAltEmail}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm text-blue-400 hover:text-white transition-all"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <Plus size={15} /> Add
              </button>
            </div>
          )}

          {error && (
            <p className="flex items-center gap-2 text-xs text-red-400 mt-2 font-bold">
              <AlertCircle size={13} /> {error}
            </p>
          )}

          <div className="mt-4 p-3 rounded-xl text-xs text-slate-400 leading-relaxed"
            style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)' }}>
            <strong className="text-blue-400">What triggers an email?</strong><br />
            Low stock · Expiry warnings · Order placed / confirmed / dispatched / delivered ·
            Admin approval decisions · Dispense confirmation · Waste records · Reorder requests
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        <AnimatePresence>
          {saved && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm font-bold text-emerald-400">
              <CheckCircle2 size={16} /> Profile saved!
            </motion.div>
          )}
          {error && !newEmail && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm font-bold text-red-400">
              <AlertCircle size={15} /> {error}
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={handleSave} disabled={saving}
          className="ml-auto glass-button-primary px-8 py-2.5 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
          <Save size={15} />
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </motion.div>
  );
}
