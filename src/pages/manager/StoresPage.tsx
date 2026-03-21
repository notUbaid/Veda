import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Search, ArrowRight, Package, AlertCircle, IndianRupee } from 'lucide-react';
import { motion } from 'framer-motion';

export function StoresPage() {
  const { stores, currentStore, setCurrentStore } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const filteredStores = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectStore = (storeId: string) => {
    const store = stores.find((s) => s.id === storeId);
    if (store) {
      setCurrentStore(store);
      navigate('/manager/inventory');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">My Managed Stores</h2>
          <p className="text-slate-400 text-sm">
            Select a store to view its inventory and analytics.
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Find store..."
            className="glass-input w-full pl-10 py-2.5 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredStores.map((store) => {
          const isActive = currentStore?.id === store.id;
          return (
            <motion.div
              key={store.id}
              whileHover={{ scale: 1.01 }}
              onClick={() => handleSelectStore(store.id)}
              className={`glass-panel p-6 cursor-pointer transition-all group ${
                isActive
                  ? 'ring-2 ring-blue-500 bg-blue-500/5'
                  : 'hover:bg-white/8 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      isActive ? 'bg-blue-600' : 'bg-white/5'
                    }`}
                  >
                    <Building2 size={24} className={isActive ? 'text-white' : 'text-slate-400'} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                      {store.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {store.location} · {store.hospitalName}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={20}
                  className="text-slate-500 group-hover:text-blue-400 transition-colors"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <Package size={14} className="mx-auto mb-1 text-blue-400" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Inventory
                  </p>
                  <p className="font-bold text-white text-sm">View</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <IndianRupee size={14} className="mx-auto mb-1 text-emerald-400" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Value
                  </p>
                  <p className="font-bold text-emerald-400 text-sm">Live</p>
                </div>
                <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 text-center">
                  <AlertCircle size={14} className="mx-auto mb-1 text-red-400" />
                  <p className="text-[10px] font-bold text-red-400/70 uppercase tracking-widest">
                    Alerts
                  </p>
                  <p className="font-bold text-red-500 text-sm">Check</p>
                </div>
              </div>

              {isActive && (
                <div className="mt-4 pt-4 border-t border-white/5 text-center">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                    Currently Active Store
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {filteredStores.length === 0 && (
        <div className="text-center py-20 text-slate-500">
          <Building2 size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-bold text-lg text-white">No stores found</p>
          <p className="text-sm">You are not assigned to any stores matching that search.</p>
        </div>
      )}
    </motion.div>
  );
}
