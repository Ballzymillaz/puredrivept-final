import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import { base44 } from '@/api/base44Client';

const PAGE_TITLES = {
  Dashboard: 'Tableau de bord',
  Drivers: 'Gestion des chauffeurs',
  Vehicles: 'Gestion des véhicules',
  FleetManagers: 'Gestionnaires de flottes',
  Commercials: 'Commerciaux',
  Documents: 'Documents',
  Applications: 'Candidatures',
  Payments: 'Paiements hebdomadaires',
  CashFlow: 'Flux de trésorerie',
  Loans: 'Prêts & Avances',
  Reimbursements: 'Remboursements',
  Referrals: 'Parrainage',
  VehiclePurchases: 'Achat de véhicules',
  Goals: 'Objectifs',
  Rankings: 'Classement',
  UPI: 'Monnaie UPI',
  PublicSite: 'Site public',
  Apply: 'Candidature',
};

// Public pages that don't need auth or sidebar
const PUBLIC_PAGES = ['PublicSite', 'Apply'];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (PUBLIC_PAGES.includes(currentPageName)) {
        setLoading(false);
        return;
      }
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        base44.auth.redirectToLogin();
        return;
      }
      const me = await base44.auth.me();
      setUser(me);
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