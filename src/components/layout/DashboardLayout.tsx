import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { OfflineBanner } from './GlobalLayoutComponents';

interface DashboardLayoutProps {
  allowedRole: 'pharmacist' | 'manager' | 'admin';
}

const PAGE_TITLES: Record<string, string> = {
  // pharmacist
  stock:          'Stock View',
  dispense:       'Dispense Medicine',
  alerts:         'Alerts & Notifications',
  query:          'AI Query',
  // manager
  stores:         'My Stores',
  inventory:      'Inventory',
  orders:         'Orders & Procurement',
  'supply-chain': 'Supply Chain',
  analytics:      'Analytics',
  waste:          'Waste Management',
  // admin
  network:        'Network & Stores',
  users:          'Identity & Access',
  audit:          'Audit Trail',
  requisitions:   'All Requisitions',
  approvals:      'Pending Approvals',
  reports:        'Global Reports',
  // shared
  profile:        'My Profile',
};

const ROLE_DEFAULT_TITLES: Record<string, string> = {
  pharmacist: 'Pharmacy Dashboard',
  manager:    'Store Management',
  admin:      'Hospital Administration',
};

export function DashboardLayout({ allowedRole }: DashboardLayoutProps) {
  const { user, profile, loading, currentStore } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">Initializing Veda...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) return <Navigate to="/login" state={{ from: location }} replace />;
  if (profile.role !== allowedRole) return <Navigate to={`/${profile.role}`} replace />;

  const pathParts = location.pathname.split('/').filter(Boolean);
  const lastSegment = pathParts[pathParts.length - 1];
  const pageTitle = PAGE_TITLES[lastSegment] ?? ROLE_DEFAULT_TITLES[allowedRole];
  const pageSubtitle = lastSegment === 'profile'
    ? profile.email
    : (currentStore?.name ?? `Welcome, ${profile.name}`);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden bg-navy-950">
      <OfflineBanner />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <main className={`flex-1 h-screen overflow-y-auto p-4 lg:p-8 scrollbar-hide ${!isOnline ? 'pt-20' : ''}`}>
        <div className="max-w-7xl mx-auto">
          <Header title={pageTitle} subtitle={pageSubtitle} onMenuClick={() => setIsSidebarOpen(true)} />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
