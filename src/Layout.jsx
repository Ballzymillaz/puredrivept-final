import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

const PAGE_TITLES = {
  Dashboard: 'Painel de controlo',
  Drivers: 'Gestão de motoristas',
  Vehicles: 'Gestão de veículos',
  FleetManagers: 'Gestores de frota',
  Commercials: 'Comerciais',
  Documents: 'Documentos',
  Applications: 'Candidaturas',
  Payments: 'Pagamentos semanais',
  CashFlow: 'Fluxo de caixa',
  IVA: 'IVA',
  Loans: 'Empréstimos & Adiantamentos',
  Reimbursements: 'Reembolsos',
  Referrals: 'Indicações',
  VehiclePurchases: 'Compra de veículos',
  Goals: 'Objetivos',
  Rankings: 'Classificação',
  UPI: 'Moeda UPI',
  PublicSite: 'Site público',
  Apply: 'Candidatura',
  Contracts: 'Contratos',
};

// Public pages that don't need auth or sidebar
const PUBLIC_PAGES = ['PublicSite', 'Apply'];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);

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
      setUser(me);

      // Check page permissions via secure backend function
      try {
        const response = await base44.functions.invoke('checkPageAccess', { pageName: currentPageName });
        setHasAccess(response.data.hasAccess);
      } catch (e) {
        // If check fails, allow access (backward compatibility)
        setHasAccess(true);
      }

      setLoading(false);
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

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-lg bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès Refusé</h1>
            <p className="text-gray-600 mb-6">Vous n'avez pas la permission d'accéder à cette page.</p>
            <button
              onClick={() => window.location.href = createPageUrl('Dashboard')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Retour au Painel
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sidebarCollapsed = false; // Will be managed by Sidebar internally

  return (
    <div className="min-h-screen bg-gray-50/80">
      <Sidebar currentPage={currentPageName} userRole={user?.role || 'admin'} />
      <div className="lg:ml-60 min-h-screen flex flex-col">
        <TopBar user={user} pageTitle={PAGE_TITLES[currentPageName] || currentPageName} />
        <main className="flex-1 p-4 md:p-6">
          {React.cloneElement(children, { currentUser: user })}
        </main>
      </div>
    </div>
  );
}