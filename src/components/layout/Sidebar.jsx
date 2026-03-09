import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Car, FileText, CreditCard, TrendingUp,
  Wallet, ShoppingCart, UserPlus, Coins, Receipt,
  ChevronLeft, ChevronRight, Settings, Menu, X,
  Building2, HandCoins, FileBarChart, PieChart, MessageCircle, Bell, Wrench
} from 'lucide-react';

// ─────────────────────────────────────────────
// STRICT ROLE-BASED MENU DEFINITIONS
// ─────────────────────────────────────────────

const ADMIN_MENU = [
  { section: 'Principal', items: [
    { name: 'Painel', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Painel do Motorista', icon: LayoutDashboard, page: 'DriverDashboard' },
  ]},
  { section: 'Gestão', items: [
    { name: 'Motoristas', icon: Users, page: 'Drivers' },
    { name: 'Veículos', icon: Car, page: 'Vehicles' },
    { name: 'Frotas', icon: Building2, page: 'Fleets' },
    { name: 'Gestores', icon: Building2, page: 'FleetManagers' },
    { name: 'Documentos', icon: FileText, page: 'Documents' },
    { name: 'Candidaturas', icon: UserPlus, page: 'Applications' },
    { name: 'Utilizadores', icon: Settings, page: 'UserManagement' },
  ]},
  { section: 'Finanças', items: [
    { name: 'Pagamentos', icon: CreditCard, page: 'Payments' },
    { name: 'Fluxo de caixa', icon: TrendingUp, page: 'CashFlow' },
    { name: 'IVA', icon: Receipt, page: 'IVA' },
    { name: 'Empréstimos', icon: Wallet, page: 'Loans' },
    { name: 'Ajustamentos', icon: Receipt, page: 'Reimbursements' },
    { name: 'Indicações', icon: HandCoins, page: 'Referrals' },
    { name: 'Compra veículos', icon: ShoppingCart, page: 'VehiclePurchases' },
  ]},
  { section: 'Desempenho', items: [
    { name: 'Classificação', icon: FileBarChart, page: 'Rankings' },
    { name: 'UPI', icon: Coins, page: 'UPI' },
    { name: 'Relatórios', icon: FileBarChart, page: 'Relatorios' },
    { name: 'Relatório Frota', icon: PieChart, page: 'RelatoriosFrota' },
    { name: 'Mensagens', icon: MessageCircle, page: 'Messaging' },
    { name: 'Notificações', icon: Bell, page: 'Notifications' },
  ]},
];

// FLEET_MANAGER_MENU is now dynamic (UPI depends on fleet config), built in getMenuByRole
const FLEET_MANAGER_MENU_BASE = [
  { section: 'Principal', items: [
    { name: 'Painel', icon: LayoutDashboard, page: 'Dashboard' },
  ]},
  { section: 'Gestão', items: [
    { name: 'Motoristas', icon: Users, page: 'Drivers' },
    { name: 'Veículos', icon: Car, page: 'Vehicles' },
    { name: 'Documentos', icon: FileText, page: 'Documents' },
  ]},
  { section: 'Finanças', items: [
    { name: 'Pagamentos', icon: CreditCard, page: 'Payments' },
    { name: 'Fluxo de caixa', icon: TrendingUp, page: 'CashFlow' },
    { name: 'Empréstimos', icon: Wallet, page: 'Loans' },
    { name: 'Indicações', icon: HandCoins, page: 'Referrals' },
    { name: 'Compra veículos', icon: ShoppingCart, page: 'VehiclePurchases' },
  ]},
  { section: 'Desempenho', items: [
    { name: 'Classificação', icon: FileBarChart, page: 'Rankings' },
    { name: 'Relatórios', icon: FileBarChart, page: 'Relatorios' },
    { name: 'Relatório Frota', icon: PieChart, page: 'RelatoriosFrota' },
    { name: 'Mensagens', icon: MessageCircle, page: 'Messaging' },
    { name: 'Notificações', icon: Bell, page: 'Notifications' },
  ]},
];

// DRIVER_MENU is dynamic (UPI depends on fleet config), built in getMenuByRole
const DRIVER_MENU_BASE = [
  { section: 'Principal', items: [
    { name: 'Painel do Motorista', icon: LayoutDashboard, page: 'DriverDashboard' },
  ]},
  { section: 'Finanças', items: [
    { name: 'Empréstimos', icon: Wallet, page: 'Loans' },
    { name: 'UPI', icon: Coins, page: 'UPI' },
    { name: 'Compra veículos', icon: ShoppingCart, page: 'VehiclePurchases' },
    { name: 'Classificação', icon: FileBarChart, page: 'Rankings' },
    { name: 'Relatórios', icon: FileBarChart, page: 'Relatorios' },
  ]},
  { section: 'Outros', items: [
    { name: 'Documentos', icon: FileText, page: 'Documents' },
    { name: 'Mensagens', icon: MessageCircle, page: 'Messaging' },
    { name: 'Notificações', icon: Bell, page: 'Notifications' },
  ]},
];

// Users with no valid role see nothing
const PENDING_MENU = [];

function getMenuByRole(role, currentUser) {
  if (role === 'admin') return ADMIN_MENU;
  if (role === 'fleet_manager') {
    // UPI: only show if fleet has upi_enabled (we don't have fleet data here, show by default)
    // UPI visibility is handled at page level; always include in sidebar for fleet_manager
    return FLEET_MANAGER_MENU_BASE;
  }
  if (role === 'driver') {
    // UPI visibility: always include, page will handle empty state
    return DRIVER_MENU_BASE;
  }
  return PENDING_MENU;
}

// ─────────────────────────────────────────────

export default function Sidebar({ currentPage, userRole, currentUser }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = userRole?.split(',').map(r => r.trim()).find(r => ['admin', 'fleet_manager', 'driver'].includes(r)) || null;
  const nav = getMenuByRole(role, currentUser);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className={cn("flex items-center gap-3 px-5 py-6 border-b border-indigo-500/20", collapsed && "justify-center px-3")}>
        {collapsed ? (
          <img
            src="/uploads/Logo%20PureDriveWhite.png"
            alt="PureDrive"
            className="h-9 w-auto object-contain"
            onError={(e) => { e.target.outerHTML = '<div class="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"><span class="text-white font-bold text-sm">PD</span></div>'; }}
          />
        ) : (
          <>
            <img
              src="/uploads/Logo%20PureDriveWhite.png"
              alt="PureDrive"
              className="h-10 w-auto object-contain"
              onError={(e) => { e.target.outerHTML = '<div class="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"><span class="text-white font-bold text-sm">PD</span></div>'; }}
            />
            <div>
              <h1 className="text-white font-semibold text-base tracking-tight">PureDrive<sup className="text-[10px]">PT</sup></h1>
              <p className="text-indigo-300 text-[11px]">Gestão de Frota</p>
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {nav.map(section => (
          <div key={section.section}>
            {!collapsed && (
              <p className="text-indigo-400/70 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">
                {section.section}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = currentPage === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
                      isActive
                        ? "bg-white/15 text-white font-medium shadow-sm"
                        : "text-indigo-200 hover:bg-white/8 hover:text-white",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <item.icon className={cn("w-[18px] h-[18px] flex-shrink-0", isActive ? "text-white" : "text-indigo-300")} />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* No role — pending message */}
        {nav.length === 0 && !collapsed && (
          <div className="px-3 py-6 text-center">
            <p className="text-indigo-300/60 text-xs">A sua conta aguarda validação por um administrador.</p>
          </div>
        )}
      </nav>

      <div className={cn("border-t border-indigo-500/20 p-3", collapsed && "flex justify-center")}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center gap-2 px-3 py-2 text-indigo-300 hover:text-white text-sm transition-colors rounded-lg hover:bg-white/8 w-full"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Reduzir</span></>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-indigo-600 text-white rounded-lg shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div className="w-64 h-full bg-gradient-to-b from-[#06081a] via-[#080e24] to-[#060816]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      <aside className={cn(
        "hidden lg:flex flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-300",
        "bg-gradient-to-b from-[#06081a] via-[#080e24] to-[#060816]",
        collapsed ? "w-[68px]" : "w-60"
      )}>
        {sidebarContent}
      </aside>
    </>
  );
}