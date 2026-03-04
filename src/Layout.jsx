import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import SimulationBanner from './components/shared/SimulationBanner';
import { SimulationProvider, useSimulation } from './components/shared/SimulationContext';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

const PAGE_TITLES = {
  Dashboard: 'Painel de controlo',
  DriverDashboard: 'Painel do Motorista',
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
  Reimbursements: 'Ajustamentos Financeiros',
  Referrals: 'Indicações',
  VehiclePurchases: 'Compra de veículos',
  Goals: 'Objetivos',
  Rankings: 'Classificação',
  UPI: 'Moeda UPI',
  Messaging: 'Mensagens',
  RelatoriosFrota: 'Relatório de Frota',
  RelatorioVeiculos: 'Relatório de Veículos',
  Relatorios: 'Relatórios',
  Notifications: 'Notificações',
  VehicleDetail: 'Detalhe do Veículo',
  UserManagement: 'Gestão de Utilizadores',
  PublicSite: 'Site público',
  Apply: 'Candidatura',
  Fleets: 'Gestão de Frotas',
  RelatorioFrotas: 'Relatório de Desempenho de Frotas',
};


// ─── STRICT ROLE ACCESS RULES ──────────────────────────────────────────────
const ROLE_ALLOWED_PAGES = {
  admin: null, // null = all pages
  fleet_manager: [
    'Dashboard', 'Drivers', 'Vehicles', 'VehicleDetail', 'Documents',
    'Payments', 'CashFlow', 'Loans', 'Reimbursements', 'Referrals',
    'UPI', 'Relatorios', 'RelatoriosFrota', 'Messaging', 'Notifications',
  ],
  driver: [
    'DriverDashboard', 'Documents', 'Loans', 'Reimbursements',
    'UPI', 'VehiclePurchases', 'Messaging', 'Notifications',
  ],
};

const PUBLIC_PAGES = ['PublicSite', 'Apply', 'ContaValidacao', 'ChangePassword'];

// Inner layout that has access to simulation context
function LayoutInner({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { simulation } = useSimulation();

  useEffect(() => {
    const loadUser = async () => {
      if (PUBLIC_PAGES.includes(currentPageName)) {
        setLoading(false);
        return;
      }
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
      // Canonical single role: pick the highest-priority role
      const rawRoles = me?.role ? me.role.split(',').map(r => r.trim()) : [];
      const canonicalRole = rawRoles.includes('admin') ? 'admin'
        : rawRoles.includes('fleet_manager') ? 'fleet_manager'
        : rawRoles.includes('driver') ? 'driver'
        : null; // null = pending/no access

      const userWithRole = { ...me, role: canonicalRole, _rawRoles: rawRoles };
      setUser(userWithRole);

      // Force password change if needed
      if (me?.must_change_password && currentPageName !== 'ChangePassword') {
        window.location.href = createPageUrl('ChangePassword');
        return;
      }

      // No valid role → show pending screen (no redirect needed, layout handles it)
      if (!canonicalRole) {
        setLoading(false);
        return;
      }

      setLoading(false);

      // Access control: redirect if page not allowed for role
      if (canonicalRole !== 'admin') {
        const allowed = ROLE_ALLOWED_PAGES[canonicalRole] || [];
        if (!allowed.includes(currentPageName)) {
          const defaultPage = canonicalRole === 'driver' ? 'DriverDashboard' : 'Dashboard';
          window.location.href = createPageUrl(defaultPage);
          return;
        }
      }
    };
    loadUser();
  }, [currentPageName]);

  if (PUBLIC_PAGES.includes(currentPageName)) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-sm">PD</span>
          </div>
          <p className="text-sm text-gray-500">A carregar...</p>
        </div>
      </div>
    );
  }

  // No valid role → pending validation screen
  if (!user?.role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl border shadow-sm p-10 max-w-sm w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
            <span className="text-3xl">⏳</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Conta em validação</h2>
            <p className="text-sm text-gray-500 mt-2">A sua candidatura está a ser analisada por um administrador. Receberá acesso assim que for aprovada.</p>
          </div>
          <button
            onClick={() => base44.auth.logout()}
            className="text-sm text-indigo-600 hover:underline"
          >
            Terminar sessão
          </button>
        </div>
      </div>
    );
  }

  // Build the effective currentUser passed to pages
  // When simulation is active, override role + inject simulation metadata
  const effectiveUser = simulation
    ? {
        ...user,
        role: simulation.role,
        _isSimulation: true,
        _simulatedTargetId: simulation.targetId,
        _simulatedTargetName: simulation.targetName,
        _realRole: 'admin', // real user is always admin when simulation is active
      }
    : user;

  // Sidebar receives real role (always admin during simulation — sidebar shows admin menu)
  const sidebarRole = user?.role || 'driver';

  return (
    <div className="min-h-screen bg-gray-50/80">
      <Sidebar currentPage={currentPageName} userRole={sidebarRole} currentUser={user} />
      <div className="lg:ml-60 min-h-screen flex flex-col">
        <TopBar user={user} pageTitle={PAGE_TITLES[currentPageName] || currentPageName} />
        <SimulationBanner />
        <main className="flex-1 p-4 md:p-6">
          {React.cloneElement(children, { currentUser: effectiveUser })}
        </main>
      </div>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <SimulationProvider>
      <LayoutInner children={children} currentPageName={currentPageName} />
    </SimulationProvider>
  );
}