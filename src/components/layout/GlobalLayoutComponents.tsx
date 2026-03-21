import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Bell, AlertTriangle, AlertCircle, Info, Check, X } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAuth } from '../../contexts/AuthContext';
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, limit
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Notification } from '../../types';
import { formatDistanceToNow } from 'date-fns';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -56, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-black px-6 py-3 flex items-center justify-center gap-3"
        >
          <WifiOff size={16} />
          <span className="font-bold text-sm">
            You are offline — changes will sync when connection restores.
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NotificationDropdown() {
  const { profile, stores } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!profile) return;

    let q;

    if (profile.role === 'admin') {
      // Admin: all unread — no orderBy to avoid needing a composite index
      q = query(
        collection(db, 'notifications'),
        where('isRead', '==', false),
        limit(30)
      );
    } else if (profile.role === 'manager' && stores.length > 0) {
      const storeIds = stores.map(s => s.id).slice(0, 10); // Firestore 'in' max = 10
      q = query(
        collection(db, 'notifications'),
        where('storeId', 'in', storeIds),
        limit(30)
      );
    } else if (profile.storeId) {
      q = query(
        collection(db, 'notifications'),
        where('storeId', '==', profile.storeId),
        limit(30)
      );
    } else {
      return;
    }

    return onSnapshot(q, snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Notification))
        // sort client-side — newest first
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(data);
    });
  }, [profile?.uid, profile?.role, stores.length]);

  const unread = notifications.filter(n => !n.isRead).length;

  const markRead = async (id: string) => {
    try { await updateDoc(doc(db, 'notifications', id), { isRead: true }); }
    catch (e) { console.error('mark read failed', e); }
  };

  const markAllRead = async () => {
    try {
      await Promise.all(
        notifications.filter(n => !n.isRead).map(n =>
          updateDoc(doc(db, 'notifications', n.id), { isRead: true })
        )
      );
    } catch (e) { console.error('mark all failed', e); }
  };

  const urgencyIcon = (n: Notification) => {
    if (n.urgency === 'critical') return <AlertTriangle size={14} className="text-red-400" />;
    if (n.urgency === 'warning')  return <AlertCircle  size={14} className="text-amber-400" />;
    return <Info size={14} className="text-blue-400" />;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="p-3 glass-card relative hover:bg-white/10 transition-all"
      >
        <Bell size={20} className="text-slate-300" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center border-2 border-navy-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-3 w-96 glass-panel shadow-2xl z-[100] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <span className="font-bold text-sm text-white">
                Notifications
                {unread > 0 && (
                  <span className="ml-2 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                    {unread}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white p-1">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto scrollbar-hide divide-y divide-white/5">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Bell size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-bold">All caught up</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id}
                    className={`px-4 py-3 flex items-start gap-3 transition-all border-l-2 ${
                      n.isRead
                        ? 'border-transparent opacity-50'
                        : n.urgency === 'critical' ? 'border-red-500'
                        : n.urgency === 'warning'  ? 'border-amber-500'
                        : 'border-blue-500'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{urgencyIcon(n)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white leading-snug">{n.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                      <p className="text-[9px] text-slate-600 mt-1 font-mono">
                        {formatDistanceToNow(new Date(n.createdAt))} ago
                      </p>
                    </div>
                    {!n.isRead && (
                      <button onClick={() => markRead(n.id)}
                        className="p-1 shrink-0 hover:bg-white/10 rounded-lg text-slate-500 hover:text-blue-400 transition-colors"
                        title="Mark as read">
                        <Check size={13} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
