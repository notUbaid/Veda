import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';

// Pharmacist
import { PharmacistDashboard } from './pages/pharmacist/PharmacistDashboard';
import { StockPage } from './pages/pharmacist/StockPage';
import { DispensePage } from './pages/pharmacist/DispensePage';
import { AlertsPage } from './pages/pharmacist/AlertsPage';
import { QueryPage } from './pages/pharmacist/QueryPage';

// Manager
import { ManagerDashboard } from './pages/manager/ManagerDashboard';
import { StoresPage } from './pages/manager/StoresPage';
import { InventoryPage } from './pages/manager/InventoryPage';
import { OrdersPage } from './pages/manager/OrdersPage';
import { SupplyChainPage } from './pages/manager/SupplyChainPage';
import { AnalyticsPage } from './pages/manager/AnalyticsPage';
import { WastePage } from './pages/manager/WastePage';

// Admin
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { NetworkPage } from './pages/admin/NetworkPage';
import { UsersPage } from './pages/admin/UsersPage';
import { AuditPage } from './pages/admin/AuditPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminApprovalsPage } from './pages/admin/AdminApprovalsPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* ── Pharmacist ─────────────────────────────── */}
          <Route path="/pharmacist" element={<DashboardLayout allowedRole="pharmacist" />}>
            <Route index element={<PharmacistDashboard />} />
            <Route path="stock"    element={<StockPage />} />
            <Route path="dispense" element={<DispensePage />} />
            <Route path="alerts"   element={<AlertsPage />} />
            <Route path="query"    element={<QueryPage />} />
            <Route path="profile"  element={<ProfilePage />} />
            <Route path="*"        element={<Navigate to="/pharmacist" replace />} />
          </Route>

          {/* ── Manager ────────────────────────────────── */}
          <Route path="/manager" element={<DashboardLayout allowedRole="manager" />}>
            <Route index element={<ManagerDashboard />} />
            <Route path="stores"       element={<StoresPage />} />
            <Route path="inventory"    element={<InventoryPage />} />
            <Route path="orders"       element={<OrdersPage />} />
            <Route path="supply-chain" element={<SupplyChainPage />} />
            <Route path="analytics"    element={<AnalyticsPage />} />
            <Route path="waste"        element={<WastePage />} />
            <Route path="profile"      element={<ProfilePage />} />
            <Route path="*"            element={<Navigate to="/manager" replace />} />
          </Route>

          {/* ── Admin ──────────────────────────────────── */}
          <Route path="/admin" element={<DashboardLayout allowedRole="admin" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="network"      element={<NetworkPage />} />
            <Route path="users"        element={<UsersPage />} />
            <Route path="audit"        element={<AuditPage />} />
            <Route path="requisitions" element={<AdminOrdersPage />} />
            <Route path="approvals"    element={<AdminApprovalsPage />} />
            <Route path="reports"      element={<AdminReportsPage />} />
            <Route path="profile"      element={<ProfilePage />} />
            <Route path="*"            element={<Navigate to="/admin" replace />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
