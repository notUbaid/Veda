import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, ShieldCheck, LogOut, X,
  LayoutDashboard, ClipboardList, BarChart3,
  Users, FileText, Package, Route,
  Bell, MessageSquare, UserCircle, AtSign,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { profile, currentStore, stores, setCurrentStore } = useAuth();
  const isOnline = useOnlineStatus();
  const role = profile?.role;

  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const check = () => setIsLg(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!isOpen && !isLg) return null;

  const altEmailCount = profile?.alternateEmails?.length ?? 0;

  const NavItem = ({
    to, icon: Icon, label, exact = false, badge,
  }: {
    to: string; icon: any; label: string; exact?: boolean; badge?: number;
  }) => (
    <NavLink
      to={to}
      end={exact}
      onClick={onClose}
      className={({ isActive }) =>
        `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
          isActive
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={20} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'} />
          <span className="font-bold text-sm flex-1">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="w-4 h-4 bg-blue-500/30 text-blue-300 text-[9px] font-bold rounded-full flex items-center justify-center">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  const roleBase = role === 'pharmacist' ? '/pharmacist' : role === 'manager' ? '/manager' : '/admin';

  return (
    <motion.aside
      initial={isLg ? false : { x: -300 }}
      animate={{ x: 0 }}
      exit={{ x: -300 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed lg:relative z-50 w-72 h-full flex flex-col glass-sidebar"
    >
      {/* ── Logo ──────────────────────────────────────── */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <img
            src="/asset/Veda.png"
            alt="Veda logo"
            className="w-9 h-9 object-contain drop-shadow-lg"
          />
          <span className="veda-wordmark">VEDA</span>
        </div>
        <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1">
          <X size={20} />
        </button>
      </div>

      {/* ── User card → profile ───────────────────────── */}
      <div className="px-4 py-3">
        <NavLink
          to={`${roleBase}/profile`}
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 p-3 rounded-2xl transition-all ${
              isActive
                ? 'bg-blue-600/20 border border-blue-500/20'
                : 'bg-white/5 hover:bg-white/8 border border-transparent'
            }`
          }
        >
          <div className="w-9 h-9 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-base shrink-0">
            {profile?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{profile?.name}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1">
              {profile?.role}
              {altEmailCount > 0 && (
                <span className="flex items-center gap-0.5 text-slate-600 normal-case">
                  · <AtSign size={8} /> {altEmailCount}
                </span>
              )}
            </p>
          </div>
          <UserCircle size={15} className="text-slate-600 shrink-0" />
        </NavLink>
      </div>

      {/* ── Navigation ────────────────────────────────── */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide pb-4">

        {/* Pharmacist */}
        {role === 'pharmacist' && (
          <>
            <NavItem to="/pharmacist"          icon={LayoutDashboard} label="Dashboard"  exact />
            <NavItem to="/pharmacist/stock"    icon={Package}         label="Stock View"      />
            <NavItem to="/pharmacist/dispense" icon={ClipboardList}   label="Dispense"         />
            <NavItem to="/pharmacist/alerts"   icon={Bell}            label="Alerts"           />
            <NavItem to="/pharmacist/query"    icon={MessageSquare}   label="AI Query"         />
            <NavItem to="/pharmacist/profile"  icon={UserCircle}      label="My Profile"
              badge={altEmailCount > 0 ? altEmailCount : undefined} />

            {currentStore && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-2">My Store</p>
                <div className="px-3 py-2 rounded-xl bg-white/5">
                  <p className="text-xs font-bold text-slate-300 truncate">{currentStore.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{currentStore.location}</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Manager */}
        {role === 'manager' && (
          <>
            <NavItem to="/manager"              icon={LayoutDashboard} label="Dashboard"     exact />
            <NavItem to="/manager/stores"       icon={Building2}       label="My Stores"          />
            <NavItem to="/manager/inventory"    icon={Package}         label="Inventory"          />
            <NavItem to="/manager/orders"       icon={ClipboardList}   label="Orders"             />
            <NavItem to="/manager/supply-chain" icon={Route}           label="Supply Chain"       />
            <NavItem to="/manager/analytics"    icon={BarChart3}       label="Analytics"          />
            <NavItem to="/manager/waste"        icon={BarChart3}       label="Waste"              />
            <NavItem to="/manager/profile"      icon={UserCircle}      label="My Profile"
              badge={altEmailCount > 0 ? altEmailCount : undefined} />

            {stores.length > 1 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-2">Switch Store</p>
                {stores.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setCurrentStore(s); onClose(); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all mb-1 ${
                      currentStore?.id === s.id
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-500/20'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <p className="text-xs font-bold truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{s.location}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Admin */}
        {role === 'admin' && (
          <>
            <NavItem to="/admin"              icon={LayoutDashboard} label="Overview"        exact />
            <NavItem to="/admin/network"      icon={Building2}       label="Network & Stores"      />
            <NavItem to="/admin/requisitions" icon={ClipboardList}   label="All Requisitions"      />
            <NavItem to="/admin/approvals"    icon={ShieldCheck}     label="Pending Approvals"     />
            <NavItem to="/admin/reports"      icon={BarChart3}       label="Global Reports"        />
            <NavItem to="/admin/audit"        icon={FileText}        label="Audit Trail"           />
            <NavItem to="/admin/users"        icon={Users}           label="Users"                 />
            <NavItem to="/admin/profile"      icon={UserCircle}      label="My Profile"
              badge={altEmailCount > 0 ? altEmailCount : undefined} />
          </>
        )}
      </nav>

      {/* ── Footer ────────────────────────────────────── */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-2 px-3 py-2 mb-2">
          {isOnline ? (
            <>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-emerald-500 font-bold">System Online</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              <span className="text-xs text-amber-500 font-bold">Offline Mode</span>
            </>
          )}
        </div>
        <button
          onClick={() => signOut(auth)}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
        >
          <LogOut size={18} />
          <span className="font-bold text-sm">Sign Out</span>
        </button>
      </div>
    </motion.aside>
  );
}
