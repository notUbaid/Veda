import React, { useState, useRef, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Batch, DispenseLog } from '../../types';
import {
  answerPharmacistQuery,
  checkOllamaHealth,
  getActiveModel,
  setActiveModel,
} from '../../services/aiService';
import {
  MessageSquare, Send, Wifi, WifiOff,
  ChevronDown, RefreshCw, Terminal, X, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const QUICK_QUERIES = [
  'Which medicines expire this week?',
  'What is the stock of Paracetamol?',
  'Which drugs are below reorder level?',
  'What did I dispense today?',
  'Which batch for Amoxicillin — FEFO?',
  'Show medicines expiring next month',
  'Which medicines have zero stock?',
  'What is the total inventory value?',
];

// Popular Ollama models the user might have
const KNOWN_MODELS = [
  'llama3.2', 'llama3.1', 'llama3', 'mistral',
  'phi3', 'phi3.5', 'gemma3', 'gemma2',
  'qwen2.5', 'qwen2', 'deepseek-r1:8b', 'neural-chat',
];

function sortFEFO(batches: Batch[]): Batch[] {
  return [...batches]
    .filter(b => !b.isDepleted && !b.isDisposed && b.quantity > 0 && new Date(b.expiryDate) > new Date())
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
}

type OllamaStatus = 'checking' | 'online' | 'offline';

export function QueryPage() {
  const { currentStore } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recentLogs, setRecentLogs] = useState<DispenseLog[]>([]);

  // Ollama status
  const [status, setStatus] = useState<OllamaStatus>('checking');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [activeModel, setActiveModelState] = useState(getActiveModel());
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [statusError, setStatusError] = useState('');

  // Chat
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Firestore data
  useEffect(() => {
    if (!currentStore) return;
    const u1 = onSnapshot(
      query(collection(db, 'medicines'), where('storeId', '==', currentStore.id), where('isActive', '==', true)),
      s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine)))
    );
    const u2 = onSnapshot(
      query(collection(db, 'batches'), where('storeId', '==', currentStore.id), where('isDepleted', '==', false)),
      s => setBatches(s.docs.map(d => ({ id: d.id, ...d.data() } as Batch)))
    );
    const u3 = onSnapshot(
      query(collection(db, 'dispense_logs'), where('storeId', '==', currentStore.id), orderBy('timestamp', 'desc'), limit(100)),
      s => setRecentLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as DispenseLog)))
    );
    return () => { u1(); u2(); u3(); };
  }, [currentStore]);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check Ollama on mount + on retry
  const checkHealth = useCallback(async () => {
    setStatus('checking');
    setStatusError('');
    const result = await checkOllamaHealth();
    if (result.ok) {
      setStatus('online');
      setAvailableModels(result.models);
      // If current model isn't in available list but list has items, keep it (user might have typed a valid model)
    } else {
      setStatus('offline');
      setStatusError(result.error ?? 'Unknown error');
    }
  }, []);

  useEffect(() => { checkHealth(); }, [checkHealth]);

  const changeModel = (m: string) => {
    setActiveModel(m);
    setActiveModelState(m);
    setShowModelPicker(false);
  };

  const handleSend = async (e?: React.FormEvent, preset?: string) => {
    if (e) e.preventDefault();
    const text = preset ?? chatInput;
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setChatInput('');
    setLoading(true);
    try {
      const reply = await answerPharmacistQuery(text, medicines, sortFEFO(batches), recentLogs);
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Status pill ──────────────────────────────────────────
  const StatusPill = () => (
    <div className="flex items-center gap-2">
      {status === 'checking' && (
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
          <RefreshCw size={11} className="animate-spin" /> Connecting to Ollama…
        </span>
      )}
      {status === 'online' && (
        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
          <Wifi size={11} /> Ollama Online
        </span>
      )}
      {status === 'offline' && (
        <span className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold">
          <WifiOff size={11} /> Ollama Offline
          <button onClick={checkHealth} className="ml-1 underline hover:text-red-300">retry</button>
        </span>
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="h-[calc(100vh-140px)] flex flex-col glass-panel overflow-hidden"
    >
      {/* ── Header ────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/5 flex-shrink-0 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
              <MessageSquare size={18} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">Veda AI — Pharmacy Query</h3>
              <p className="text-xs text-slate-500">Powered by local Ollama · your data never leaves your machine</p>
            </div>
          </div>

          {/* Model picker + status */}
          <div className="flex items-center gap-3 shrink-0">
            <StatusPill />

            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                  status === 'online'
                    ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    : 'bg-white/3 border-white/5 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Settings size={11} />
                {activeModel}
                <ChevronDown size={11} className={showModelPicker ? 'rotate-180' : ''} />
              </button>

              <AnimatePresence>
                {showModelPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute right-0 top-full mt-1 w-52 bg-navy-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
                  >
                    <div className="p-2 border-b border-white/5">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2 py-1">
                        {availableModels.length > 0 ? 'Installed models' : 'Common models'}
                      </p>
                    </div>
                    <div className="max-h-60 overflow-y-auto scrollbar-hide py-1">
                      {(availableModels.length > 0 ? availableModels : KNOWN_MODELS).map(m => (
                        <button
                          key={m}
                          onClick={() => changeModel(m)}
                          className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                            m === activeModel
                              ? 'bg-blue-600 text-white font-bold'
                              : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          {m}
                          {m === activeModel && <span className="ml-2 text-[9px] opacity-70">active</span>}
                        </button>
                      ))}
                    </div>
                    {/* Custom model input */}
                    <div className="p-2 border-t border-white/5">
                      <input
                        type="text"
                        placeholder="Type any model name…"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val) changeModel(val);
                          }
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Quick queries */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => handleSend(undefined, q)}
              disabled={status !== 'online' || loading}
              className="px-3 py-1.5 bg-white/5 border border-white/8 rounded-full text-[11px] text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ── Offline setup guide ────────────────────────────── */}
      <AnimatePresence>
        {status === 'offline' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-red-500/20 bg-red-500/5 flex-shrink-0"
          >
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-red-400" />
                <p className="text-sm font-bold text-red-400">Ollama is not running</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Veda uses <span className="text-white font-bold">Ollama</span> for all AI features — a free, local AI runtime.
                Your pharmacy data never leaves your machine.
              </p>
              <div className="space-y-2">
                {[
                  { step: '1', label: 'Install Ollama', cmd: 'winget install Ollama.Ollama', sub: 'or download from ollama.com' },
                  { step: '2', label: 'Start the server', cmd: 'ollama serve' },
                  { step: '3', label: 'Pull a model', cmd: 'ollama pull llama3.2', sub: '~2GB — fast & accurate' },
                ].map(({ step, label, cmd, sub }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-red-400">{step}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white">{label}</p>
                      <code className="text-[11px] font-mono text-emerald-400 bg-black/30 px-2 py-0.5 rounded block mt-0.5 break-all">{cmd}</code>
                      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={checkHealth}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-xs font-bold text-red-300 hover:bg-red-500/30 transition-all"
              >
                <RefreshCw size={12} /> Check Again
              </button>
              {statusError && (
                <p className="text-[10px] text-red-500 font-mono">{statusError}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chat messages ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-hide">
        {messages.length === 0 && status === 'online' && (
          <div className="h-full flex items-center justify-center text-center">
            <div className="opacity-30">
              <MessageSquare size={40} className="mx-auto mb-3 text-slate-500" />
              <p className="text-slate-400 font-bold text-sm">Ask anything about your pharmacy</p>
              <p className="text-slate-600 text-xs mt-1">Running on {activeModel} · 100% local</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-blue-400">AI</span>
              </div>
            )}
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-white/5 border border-white/10 text-slate-300 rounded-tl-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-blue-400">AI</span>
            </div>
            <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1.5 items-center">
              {[0, 0.2, 0.4].map((d, i) => (
                <div key={i} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
              ))}
              <span className="text-[10px] text-slate-600 ml-2 font-mono">{activeModel}</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Input ─────────────────────────────────────────── */}
      <form
        onSubmit={handleSend}
        className="px-4 py-3 border-t border-white/5 shrink-0 flex gap-2"
      >
        <input
          type="text"
          className="glass-input flex-1 py-3 text-sm"
          placeholder={
            status === 'offline'
              ? 'Start Ollama to enable AI queries…'
              : `Ask about stock, expiry, FEFO… (${activeModel})`
          }
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          disabled={status !== 'online' || loading}
        />
        <button
          type="submit"
          disabled={status !== 'online' || loading || !chatInput.trim()}
          className="w-11 h-11 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all disabled:opacity-40 shrink-0"
        >
          {loading
            ? <RefreshCw size={16} className="animate-spin" />
            : <Send size={16} />
          }
        </button>
      </form>
    </motion.div>
  );
}
