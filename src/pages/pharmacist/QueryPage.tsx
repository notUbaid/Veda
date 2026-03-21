import React, { useState, useRef, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Medicine, Batch, DispenseLog } from '../../types';
import { answerPharmacistQuery } from '../../services/aiService';
import { MessageSquare, Send } from 'lucide-react';
import { motion } from 'framer-motion';

const QUICK_QUERIES = [
  'Which medicines expire this week?',
  'What is my current stock of Paracetamol?',
  'Which drugs are below reorder level?',
  'What did I dispense today?',
  'Which batch should I dispense for Amoxicillin?',
  'Show medicines expiring next month',
  'Total stock value in Row B',
  'Which medicines have zero stock?'
];

function sortFEFO(batches: Batch[]): Batch[] {
  return [...batches]
    .filter(b => !b.isDepleted && !b.isDisposed && b.quantity > 0 && new Date(b.expiryDate) > new Date())
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
}

export function QueryPage() {
  const { currentStore } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recentLogs, setRecentLogs] = useState<DispenseLog[]>([]);

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'veda'; text: string }[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentStore) return;
    const u1 = onSnapshot(query(collection(db, 'medicines'), where('storeId', '==', currentStore.id), where('isActive', '==', true)),
      s => setMedicines(s.docs.map(d => ({ id: d.id, ...d.data() } as Medicine))));
    const u2 = onSnapshot(query(collection(db, 'batches'), where('storeId', '==', currentStore.id), where('isDepleted', '==', false)),
      s => setBatches(s.docs.map(d => ({ id: d.id, ...d.data() } as Batch))));
    const u3 = onSnapshot(query(collection(db, 'dispense_logs'), where('storeId', '==', currentStore.id), orderBy('timestamp', 'desc'), limit(100)),
      s => setRecentLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as DispenseLog))));
    return () => { u1(); u2(); u3(); };
  }, [currentStore]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleChat = async (e?: React.FormEvent, predefinedQuery?: string) => {
    if (e) e.preventDefault();
    const userMsg = predefinedQuery || chatInput;
    if (!userMsg.trim()) return;

    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput(''); 
    setIsAiLoading(true);

    try {
      const response = await answerPharmacistQuery(userMsg, medicines, sortFEFO(batches), recentLogs);
      setChatMessages(prev => [...prev, { role: 'veda', text: response }]);
    } catch (e: any) {
      const isRateLimit = e?.message?.includes('429');
      setChatMessages(prev => [...prev, { role: 'veda', text: isRateLimit ? 'Rate limit reached — please wait a minute.' : 'AI is temporarily unavailable.' }]);
    } finally { setIsAiLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[calc(100vh-140px)] flex flex-col glass-panel overflow-hidden relative">
        <div className="p-6 border-b border-white/5 flex flex-col shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center"><MessageSquare size={20} className="text-emerald-400" /></div>
                <div>
                    <h3 className="font-bold text-lg text-white">Ask your pharmacy anything</h3>
                    <p className="text-sm text-slate-400">Quick answers from your live stock data</p>
                </div>
            </div>
            
            <div className="mt-6">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Suggested Queries</p>
                <div className="flex flex-wrap gap-2">
                    {QUICK_QUERIES.map(q => (
                        <button key={q} onClick={() => handleChat(undefined, q)} 
                                className="px-4 py-2 bg-white/5 border border-white/5 rounded-full text-xs text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all text-left ios-shadow">
                            {q}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            {chatMessages.length === 0 && (
                <div className="h-full flex items-center justify-center text-center px-4">
                    <div>
                        <MessageSquare size={48} className="mx-auto text-slate-600 mb-4 opacity-30"/>
                        <p className="text-slate-500 font-medium">Hello there. I'm Veda's native AI.</p>
                        <p className="text-slate-600 text-sm mt-1">I can query your entire live inventory.</p>
                    </div>
                </div>
            )}
            {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'veda' && (
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 flex flex-shrink-0 items-center justify-center mr-3 mt-1 shadow-lg border border-blue-500/30">
                         <span className="text-[10px] font-bold text-blue-400">AI</span>
                    </div>
                )}
                <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap ios-shadow ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white/5 border border-white/10 text-slate-300 rounded-tl-sm glass-panel'}`}>
                    {msg.text}
                </div>
            </div>
            ))}
            {isAiLoading && (
            <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 p-4 rounded-3xl rounded-tl-sm flex gap-1.5 glass-panel h-12 items-center min-w-[80px] justify-center ml-11 ios-shadow">
                {[0, 0.2, 0.4].map((d, i) => <div key={i} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />)}
                </div>
            </div>
            )}
            <div ref={chatEndRef} />
        </div>

        <form onSubmit={(e) => handleChat(e)} className="p-6 border-t border-white/5 shrink-0 bg-navy-950/50 backdrop-blur-xl">
            <div className="relative">
                <input type="text" className="glass-input w-full py-4 pl-6 pr-16 bg-navy-900 shadow-xl border-white/10 text-sm focus:border-blue-500/50" 
                    placeholder="Type a custom query here..." 
                    value={chatInput} onChange={e => setChatInput(e.target.value)} />
                <button type="submit" disabled={isAiLoading || !chatInput.trim()} 
                    className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50">
                    <Send size={18} />
                </button>
            </div>
        </form>
    </motion.div>
  );
}
