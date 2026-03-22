import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Notification, Medicine, UserProfile } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, AlertTriangle, AlertCircle, Info, Check, Clock,
  Package, Bot, RefreshCw, Lightbulb, Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { emailNotification } from '../../services/emailService';
import { getRecipientEmails } from '../../services/notifyHelpers';
import { getAlertTriage } from '../../services/aiService';
import { useOllama } from '../../hooks/useOllama';
import { AIStatusBar } from '../../components/ai/AIStatusBar';

export function AlertsPage() {
  const { profile, currentStore } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [medicines,     setMedicines]     = useState<Medicine[]>([]);
  const [batches,       setBatches]       = useState<any[]>([]);
  const [activeTab,     setActiveTab]     = useState<'critical' | 'warning' | 'info'>('critical');

  // AI triage
  const ollama = useOllama();
  const [triage,       setTriage]       = useState<any[]>([]);
  const [loadingTriage, setLoadingTriage] = useState(false);
  const [triageError,   setTriageError]   = useState('');

  useEffect(() => {
    if (!currentStore || !profile) return;
    const u1 = onSnapshot(
      query(collection(db, 'notifications'), where('storeId', '==', currentStore.id)),
      s => setNotifications(
        s.docs.map(d => ({ id: d.id, ...d.data() } as Notification))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      )
    );
    const u2 = onSnapshot(
      query(collection(db, 'medicines'), where('storeId', '==', currentStore.id)),
      s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine)))
    );
    const u3 = onSnapshot(
      query(collection(db, 'batches'), where('storeId', '==', currentStore.id), where('isDepleted', '==', false)),
      s => setBatches(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { u1(); u2(); u3(); };
  }, [currentStore, profile]);

  const runTriage = async () => {
    if (!currentStore || notifications.length === 0 || loadingTriage) return;
    setLoadingTriage(true); setTriageError('');
    try {
      const result = await getAlertTriage(notifications, medicines, batches);
      setTriage(result);
    } catch (e: any) {
      setTriageError(e.message?.includes('fetch') ? 'Ollama not running — run: ollama serve' : e.message ?? 'AI error');
    } finally { setLoadingTriage(false); }
  };

  const getTriageFor = (alertId: string) => triage.find(t => t.alertId === alertId);

  const markAsRead = async (id: string) => {
    try { await updateDoc(doc(db, 'notifications', id), { isRead: true }); }
    catch (e) { console.error('Failed to mark read', e); }
  };

  const markAllAsRead = async () => {
    const active = notifications.filter(n => n.urgency === activeTab && !n.isRead);
    await Promise.all(active.map(n => updateDoc(doc(db, 'notifications', n.id), { isRead: true })));
  };

  const sendReminder = async (medId: string | undefined) => {
    if (!currentStore || !profile || !medId) return;
    const med = medicines.find(m => m.id === medId);
    if (!med) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        storeId:     currentStore.id,
        type:        'reorder_reminder',
        title:       `Reorder Reminder: ${med.name}`,
        message:     `${profile.name} requests reorder for ${med.name}. Stock is critically low.`,
        urgency:     'warning',
        isRead:      false,
        createdAt:   new Date().toISOString(),
        medicineId:  med.id,
        requestedBy: profile.uid,
      });
      emailNotification({
        recipientName:   profile.name,
        recipientEmails: getRecipientEmails(profile),
        title:           `Reorder Reminder Sent: ${med.name}`,
        message:         `You sent a reorder reminder for ${med.name} at ${currentStore.name}.`,
        urgency:         'warning',
        storeName:       currentStore.name,
        details:         { Medicine: med.name, 'Sent by': profile.name },
      }).catch(console.warn);
      const mgrSnap = await getDocs(
        query(collection(db, 'users'), where('uid', '==', currentStore.managerId ?? ''))
      );
      if (!mgrSnap.empty) {
        const mgr = mgrSnap.docs[0].data() as UserProfile;
        emailNotification({
          recipientName:   mgr.name,
          recipientEmails: getRecipientEmails(mgr),
          title:           `Reorder Request: ${med.name}`,
          message:         `${profile.name} flagged ${med.name} as critically low at ${currentStore.name}.`,
          urgency:         'warning',
          storeName:       currentStore.name,
          details:         { Medicine: med.name, 'Requested by': profile.name },
        }).catch(console.warn);
      }
    } catch (e) { console.error(e); }
  };

  const filtered = useMemo(() => notifications.filter(n => n.urgency === activeTab), [notifications, activeTab]);
  const counts = {
    critical: notifications.filter(n => n.urgency === 'critical' && !n.isRead).length,
    warning:  notifications.filter(n => n.urgency === 'warning'  && !n.isRead).length,
    info:     notifications.filter(n => n.urgency === 'info'     && !n.isRead).length,
  };

  const getIcon = (type: string) => {
    if (type === 'expiry')    return <Clock size={15} />;
    if (type === 'low_stock') return <Package size={15} />;
    return <AlertTriangle size={15} />;
  };

  const priorityBadge: Record<string, string> = {
    immediate:  'bg-red-500/20 text-red-400 border-red-500/20',
    today:      'bg-amber-500/20 text-amber-400 border-amber-500/20',
    this_week:  'bg-blue-500/20 text-blue-400 border-blue-500/20',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-5">

      {/* AI Triage bar */}
      <div className="glass-panel p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
            <Bot size={15} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white flex items-center gap-2">
              AI Alert Triage
              <AIStatusBar status={ollama.status} activeModel={ollama.activeModel} onRetry={ollama.retry} />
            </p>
            <p className="text-[10px] text-slate-500">Prioritises alerts and suggests actions for each</p>
          </div>
        </div>
        <button
          onClick={runTriage}
          disabled={loadingTriage || ollama.status !== 'online' || notifications.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-blue-300 text-xs font-bold rounded-xl transition-all disabled:opacity-40 shrink-0"
        >
          {loadingTriage
            ? <><RefreshCw size={12} className="animate-spin" /> Triaging…</>
            : triage.length > 0
            ? <><RefreshCw size={12} /> Refresh Triage</>
            : <><Zap size={12} /> Triage Alerts</>
          }
        </button>
      </div>
      {triageError && <p className="text-xs text-red-400 font-bold px-2">{triageError}</p>}

      {/* Tabs */}
      <div className="flex gap-2 p-1 glass-panel">
        {(['critical', 'warning', 'info'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 capitalize ${
              activeTab === tab
                ? tab === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : tab === 'warning' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-white'
            }`}>
            {tab}
            {counts[tab] > 0 && (
              <span className={`text-white text-[10px] px-2 py-0.5 rounded-full ${
                tab === 'critical' ? 'bg-red-500' : tab === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
              }`}>{counts[tab]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="glass-panel p-6 min-h-[500px] flex flex-col">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-white capitalize">{activeTab} Alerts</h3>
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
                className="flex flex-col items-center justify-center text-slate-500 mt-20">
                <Bell size={36} className="mb-3 opacity-30" />
                <p className="font-bold">No {activeTab} alerts</p>
              </motion.div>
            ) : (
              filtered.map(notif => {
                const triageInfo = getTriageFor(notif.id);
                return (
                  <motion.div key={notif.id} layout
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-4 rounded-2xl flex items-start gap-4 transition-all border ${
                      notif.isRead ? 'bg-white/5 border-white/5 opacity-60' : 'bg-white/10 border-white/20'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      activeTab === 'critical' ? 'bg-red-500/20 text-red-400'
                      : activeTab === 'warning' ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {getIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-white">{notif.title}</h4>
                      <p className="text-sm text-slate-300 mt-1 leading-relaxed">{notif.message}</p>

                      {/* AI Triage result */}
                      {triageInfo && (
                        <div className={`mt-2.5 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${priorityBadge[triageInfo.priority] ?? 'bg-white/5 border-white/10 text-slate-300'}`}>
                          <Lightbulb size={11} className="shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold uppercase tracking-widest text-[9px] mr-2">{triageInfo.priority?.replace('_', ' ')}</span>
                            <span>{triageInfo.suggestedAction}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          {formatDistanceToNow(new Date(notif.createdAt))} ago
                        </span>
                        {notif.type === 'low_stock' && (
                          <button onClick={() => sendReminder(notif.medicineId)}
                            className="text-[10px] text-amber-400 hover:text-amber-300 font-bold uppercase tracking-wider border border-amber-500/20 px-2 py-0.5 rounded-md hover:bg-amber-500/10">
                            Send Reorder Request
                          </button>
                        )}
                      </div>
                    </div>

                    {!notif.isRead && (
                      <button onClick={() => markAsRead(notif.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors shrink-0"
                        title="Mark as Read">
                        <Check size={13} />
                      </button>
                    )}
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
