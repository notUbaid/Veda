import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  doc, getDoc, setDoc, collection,
  query, where, onSnapshot
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Store } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  stores: Store[];
  currentStore: Store | null;
  setCurrentStore: (store: Store | null) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]               = useState<User | null>(null);
  const [profile, setProfile]         = useState<UserProfile | null>(null);
  const [loading, setLoading]         = useState(true);
  const [stores, setStores]           = useState<Store[]>([]);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `users/${user.uid}`);
    }
  }, [user]);

  // ── Auth listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const snap   = await getDoc(docRef);
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            const role =
              firebaseUser.email?.endsWith('@manager.com') ? 'manager' :
              firebaseUser.email?.endsWith('@admin.com')   ? 'admin'   : 'pharmacist';
            const newProfile: UserProfile = {
              uid:             firebaseUser.uid,
              email:           firebaseUser.email!,
              name:            firebaseUser.displayName || firebaseUser.email!.split('@')[0],
              role:            role as UserProfile['role'],
              createdAt:       new Date().toISOString(),
              isActive:        true,
              alternateEmails: [],
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
        setCurrentStore(null);
        setStores([]);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Stores listener ────────────────────────────────────────────────────
  // Re-runs whenever the logged-in user (uid) changes.
  useEffect(() => {
    if (!profile) return;

    // Reset store selection for new profile
    setCurrentStore(null);
    setStores([]);

    if (profile.role === 'admin') {
      const unsub = onSnapshot(
        collection(db, 'stores'),
        snap => {
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Store));
          setStores(data);
          setCurrentStore(prev => prev ?? (data[0] ?? null));
        },
        e => handleFirestoreError(e, OperationType.LIST, 'stores')
      );
      return unsub;
    }

    if (profile.role === 'manager') {
      const unsub = onSnapshot(
        query(collection(db, 'stores'), where('managerId', '==', profile.uid)),
        snap => {
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Store));
          setStores(data);
          setCurrentStore(prev => prev ?? (data[0] ?? null));
        },
        e => handleFirestoreError(e, OperationType.LIST, 'stores')
      );
      return unsub;
    }

    if (profile.storeId) {
      getDoc(doc(db, 'stores', profile.storeId))
        .then(snap => {
          if (snap.exists()) {
            const store = { id: snap.id, ...snap.data() } as Store;
            setStores([store]);
            setCurrentStore(store);
          }
        })
        .catch(e => handleFirestoreError(e, OperationType.GET, `stores/${profile.storeId}`));
    }
  // profile.uid is the stable identity key — changes on login/logout
  }, [profile?.uid, profile?.role, profile?.storeId]); // eslint-disable-line

  return (
    <AuthContext.Provider value={{ user, profile, loading, stores, currentStore, setCurrentStore, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
