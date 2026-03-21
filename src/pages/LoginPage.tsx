import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { Pill, ShieldCheck, Building2, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { user, profile } = useAuth();

  if (user && profile) {
    return <Navigate to={`/${profile.role}`} replace />;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth.*\)\.?/, ''));
    } finally {
      setLoading(false);
    }
  };

  const fill = (e: string, p: string) => { setEmail(e); setPassword(p); };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-navy-950">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full point-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full point-events-none" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-10 max-w-md w-full relative z-10 mx-auto">

        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img src="/asset/Veda.png" alt="Veda Logo" className="w-auto h-20 drop-shadow-[0_0_20px_rgba(37,99,235,0.4)] object-contain" />
            <h1 className="text-5xl font-serif font-medium tracking-[0.2em] text-white veda-wordmark pt-2">VEDA</h1>
          </div>
          <p className="text-slate-500 font-medium italic text-sm">Precision inventory for the medicines that matter.</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-2">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="glass-input w-full" placeholder="name@hospital.com" required />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-2">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="glass-input w-full" placeholder="••••••••" required />
          </div>
          {error && <p className="text-red-400 text-xs font-bold text-center bg-red-500/10 p-3 rounded-xl">{error}</p>}
          <button type="submit" disabled={loading} className="glass-button-primary w-full py-4 text-base">
            {loading ? 'Authenticating...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
          
          <div className="text-center pt-2">
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-xs font-bold text-blue-400 hover:text-white transition-colors">
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </form>

        <div className="mt-8">
            <div className="flex justify-center gap-2 mb-4">
                <span className="text-[10px] px-2 py-1 bg-white/5 rounded text-indigo-300 font-mono">@admin</span>
                <span className="text-[10px] px-2 py-1 bg-white/5 rounded text-blue-300 font-mono">@manager</span>
                <span className="text-[10px] px-2 py-1 bg-white/5 rounded text-emerald-300 font-mono">pharmacists</span>
            </div>
            
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-3">
                Demo Accounts — click to fill
                </p>
                <div className="grid grid-cols-1 gap-2">
                {[
                    { label: 'Admin',        email: 'ubaid@admin.com',    icon: ShieldCheck, color: 'text-indigo-400' },
                    { label: 'Manager A',    email: 'ubaid1@manager.com', icon: Building2,   color: 'text-blue-400'   },
                    { label: 'Manager B',    email: 'ubaid2@manager.com', icon: Building2,   color: 'text-blue-400'   },
                    { label: 'Pharmacist 1', email: 'ubaid1@gmail.com',   icon: UserIcon,    color: 'text-emerald-400'},
                ].map(({ label, email: e, icon: Icon, color }) => (
                    <button key={e} type="button" onClick={() => fill(e, 'Veda@2026')}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-all text-left">
                    <Icon size={14} className={color} />
                    <div>
                        <span className="text-xs font-bold text-slate-300">{label}</span>
                        <span className="text-[10px] text-slate-500 ml-2">{e}</span>
                    </div>
                    </button>
                ))}
                </div>
            </div>
        </div>
      </motion.div>
    </div>
  );
}
