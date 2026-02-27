import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import NotificationCenter from './components/shared/NotificationCenter';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

const PAGE_TITLES = {
  Drivers: 'Gestão de motoristas',
  Vehicles: 'Gestão de veículos',
  FleetManagers: 'Gestores de frota',
  Documents: 'Documentos',
  CashFlow: 'Fluxo de caixa',
  IVA: 'IVA',
  Loans: 'Empréstimos & Adiantamentos',
  Reimbursements: 'Reembolsos',
  Referrals: 'Indicações',
  VehiclePurchases: 'Compra de veículos',
  Goals: 'Objetivos',
  Rankings: 'Classificação',
  UPI: 'Moeda UPI',
  Notifications: 'Notificações',
  UserManagement: 'Gestão de Utilizadores',
  PublicSite: 'Site público',
  Fleets: 'Gestão de Frotas',
  FleetVehicles: 'Veículos de Frota',
  FleetDrivers: 'Motoristas de Frota',
  DocumentManagement: 'Gestão de Documentos',
  VehicleManagement: 'Gestão de Veículos',
  DriverPerformance: 'Análise de Performance de Motoristas',
  Configuracoes: 'Configurações',
  Onboarding: 'Onboarding',
  Relatorios: 'Relatórios Gerais',
  AdvancedReports: 'Relatórios Avançados',
};

// Public pages that don't need auth or sidebar
const PUBLIC_PAGES = ['PublicSite'];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (PUBLIC_PAGES.includes(currentPageName)) {
        setLoading(false);
        return;
      }
      
      // Redirect root to PublicSite
      if (window.location.pathname === '/') {
        window.location.href = createPageUrl('PublicSite');
        return;
      }

      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        base44.auth.redirectToLogin();
        return;
      }
      const me = await base44.auth.me();
      // Support multi-roles: roles can be comma-separated or a single string
      const userRoles = me?.role ? me.role.split(',').map(r => r.trim()) : [];
      const hasRole = (r) => userRoles.includes(r);
      setUser({ ...me, roles: userRoles, hasRole });
      setLoading(false);

      // Redirect pure users to Onboarding
      if (hasRole('user') && !hasRole('admin') && !hasRole('fleet_manager') && !hasRole('driver')) {
        if (currentPageName !== 'Onboarding') {
          window.location.href = createPageUrl('Onboarding');
          return;
        }
      }
      // Redirect pure drivers (no admin/fleet role) to their allowed pages
      const DRIVER_ALLOWED_PAGES = ['Onboarding', 'Documents', 'Loans', 'Reimbursements', 'Goals', 'Rankings', 'UPI', 'VehiclePurchases', 'Notifications'];
      if (hasRole('driver') && !hasRole('admin') && !hasRole('fleet_manager')) {
        if (!DRIVER_ALLOWED_PAGES.includes(currentPageName)) {
          window.location.href = createPageUrl('Onboarding');
          return;
        }
      }
      // Redirect pure fleet_manager away from admin-only pages
      const FLEET_ALLOWED_PAGES = ['Onboarding', 'FleetVehicles', 'FleetDrivers', 'Fleets', 'Documents', 'DocumentManagement', 'VehicleManagement', 'Referrals', 'DriverPerformance', 'Goals', 'Rankings', 'Relatorios', 'AdvancedReports', 'FleetManagers', 'Notifications', 'Configuracoes'];
      if (hasRole('fleet_manager') && !hasRole('admin') && !hasRole('driver') && !FLEET_ALLOWED_PAGES.includes(currentPageName)) {
        window.location.href = createPageUrl('Onboarding');
        return;
      }
    };
    loadUser();
  }, [currentPageName]);

  if (PUBLIC_PAGES.includes(currentPageName)) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-sm">PD</span>
          </div>
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  const sidebarCollapsed = false; // Will be managed by Sidebar internally

  return (
    <div className="min-h-screen bg-gray-50/80">
      <NotificationCenter currentUser={user} />
      <Sidebar currentPage={currentPageName} userRole={user?.role || 'admin'} currentUser={user} />
      <div className="lg:ml-60 min-h-screen flex flex-col">
        <TopBar user={user} pageTitle={PAGE_TITLES[currentPageName] || currentPageName} />
        <main className="flex-1 p-4 md:p-6">
          {React.cloneElement(children, { currentUser: user })}
        </main>
      </div>
    </div>
  );
}