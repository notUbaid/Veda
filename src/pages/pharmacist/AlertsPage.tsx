import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Notification, Medicine, UserProfile } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertTriangle, AlertCircle, Info, Check, Clock, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { emailNotification } from '../../services/emailService';
import { getRecipientEmails } from '../../services/notifyHelpers';

export function AlertsPage() {
  const { profile, currentStore } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [activeTab, setActiveTab] = useState<'critical' | 'warning' | 'info'>('critical');

  useEffect(() => {
    if (!currentStore || !profile) return;
    const qA = query(collection(db, 'notifications'), where('storeId', '==', currentStore.id));
    const unsubA = onSnapshot(qA,
      s => setNotifications(
        s.docs.map(d => ({ id: d.id, ...d.data() } as Notification))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      ),
      e => handleFirestoreError(e, OperationType.LIST, 'notifications'));
    const u1 = onSnapshot(
      query(collection(db, 'medicines'), where('storeId', '==', currentStore.id)),
      s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine)))
    );
    return () => { unsubA(); u1(); };
  }, [currentStore, profile]);

  const markAsRead = async (id: string) => {
    try { await updateDoc(doc(db, 'notifications', id), { isRead: true }); }
    catch (e) { console.error('Failed to mark read', e); }
  };

  const markAllAsRead = async () => {
    try {
      const active = notifications.filter(n => n.urgency === activeTab && !n.isRead);
      await Promise.all(active.map(n => updateDoc(doc(db, 'notifications', n.id), { isRead: true })));
    } catch (e) { console.error('Failed batch read', e); }
  };

  const sendReminder = async (medId: string | undefined) => {
    if (!currentStore || !profile || !medId) return;
    const med = medicines.find(m => m.id === medId);
    if (!med) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        storeId: currentStore.id,
        type: 'reorder_reminder',
        title: `Reorder Reminder: ${med.name}`,
        message: `${profile.name} requests reorder for ${med.name}. Stock is critically low.`,
        urgency: 'warning',
        isRead: false,
        createdAt: new Date().toISOString(),
        medicineId: med.id,
        requestedBy: profile.uid,
      });

      // Also email the pharmacist who clicked (themselves) + find and email the store manager
      emailNotification({
        recipientName:   profile.name,
        recipientEmails: getRecipientEmails(profile),
        title:           `Reorder Reminder Sent: ${med.name}`,
        message:         `You sent a reorder reminder for ${med.name} at ${currentStore.name}. The manager has been notified.`,
        urgency:         'warning',
        storeName:       currentStore.name,
        details:         { Medicine: med.name, 'Sent by': profile.name },
      }).catch(console.warn);

      // Email the store manager too
      try {
        const storeSnap = await getDocs(
          query(collection(db, 'users'), where('uid', '==', currentStore.managerId ?? ''))
        );
        if (!storeSnap.empty) {
          const manager = storeSnap.docs[0].data() as UserProfile;
          emailNotification({
            recipientName:   manager.name,
            recipientEmails: getRecipientEmails(manager),
            title:           `⚠ Reorder Request: ${med.name}`,
            message:         `${profile.name} has flagged ${med.name} at ${currentStore.name} as critically low and is requesting an urgent reorder.`,
            urgency:         'warning',
            storeName:       currentStore.name,
            details: {
              'Medicine':     med.name,
              'Requested by': profile.name,
              'Store':        currentStore.name,
              'Action':       'Please place a procurement order',
            },
          }).catch(console.warn);
        }
      } catch (e) { console.warn('Manager email lookup failed:', e); }

    } catch (e) { console.error(e); }
  };

  const filtered = useMemo(() => notifications.filter(n => n.urgency === activeTab), [notifications, activeTab]);
  const counts = {
    critical: notifications.filter(n => n.urgency === 'critical' && !n.isRead).length,
    warning:  notifications.filter(n => n.urgency === 'warning'  && !n.isRead).length,
    info:     notifications.filter(n => n.urgency === 'info'     && !n.isRead).length,
  };

  const getIcon = (type: string, urgency: string) => {
    if (type === 'expiry')    return <Clock size={16} />;
    if (type === 'low_stock') return <Package size={16} />;
    if (urgency === 'critical') return <AlertTriangle size={16} />;
    if (urgency === 'warning')  return <AlertCircle size={16} />;
    return <Info size={16} />;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">

      {/* Tabs */}
      <div className="flex gap-2 p-1 glass-panel">
        {(['critical', 'warning', 'info'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 capitalize ${
              activeTab === tab
                ? tab === 'critical' ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                  : tab === 'warning' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-white'
            }`}>
            {tab} Alerts
            {counts[tab] > 0 && (
              <span className={`text-white text-[10px] px-2 py-0.5 rounded-full ${
                tab === 'critical' ? 'bg-red-500' : tab === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
              }`}>{counts[tab]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="glass-panel p-6 min-h-[500px] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-white capitalize">{activeTab} Notifications</h3>
          {filtered.some(f => !f.isRead) && (
            <button onClick={markAllAsRead}
              className="text-xs text-blue-400 hover:text-blue-300 font-bold px-3 py-1.5 glass-card bg-blue-500/10 hover:bg-blue-500/20">
              Mark all as read
            </button>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <AnimatePresence>
            {filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-slate-500 mt-20">
                <Bell size={40} className="mb-4 opacity-30" />
                <p className="font-bold text-lg">All caught up!</p>
                <p className="text-sm">No {activeTab} alerts.</p>
              </motion.div>
            ) : (
              filtered.map(notif => (
                <motion.div key={notif.id} layout
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-4 rounded-2xl flex items-start gap-4 transition-all border ${
                    notif.isRead ? 'bg-white/5 border-white/5 opacity-60' : 'bg-white/10 border-white/20'
                  }`}>

                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    activeTab === 'critical' ? 'bg-red-500/20 text-red-500'
                    : activeTab === 'warning' ? 'bg-amber-500/20 text-amber-500'
                    : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {getIcon(notif.type, notif.urgency ?? 'info')}
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <h4 className="font-bold text-sm text-white">{notif.title}</h4>
                    <p className="text-sm text-slate-300 mt-1 leading-relaxed">{notif.message}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {formatDistanceToNow(new Date(notif.createdAt))} ago
                      </span>
                      {notif.type === 'low_stock' && (
                        <button onClick={() => sendReminder(notif.medicineId)}
                          className="text-[10px] text-amber-500 hover:text-amber-400 font-bold uppercase tracking-wider border border-amber-500/20 px-2 py-0.5 rounded-md hover:bg-amber-500/10">
                          Send Reorder Request
                        </button>
                      )}
                    </div>
                  </div>

                  {!notif.isRead && (
                    <button onClick={() => markAsRead(notif.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors"
                      title="Mark as Read">
                      <Check size={14} />
                    </button>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
