import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Car, FileText, CreditCard, TrendingUp,
  Wallet, ShoppingCart, UserPlus, Coins, Receipt,
  ChevronLeft, ChevronRight, Settings, Menu, X,
  Building2, HandCoins, FileBarChart, PieChart, MessageCircle, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { section: 'Principal', items: [
    { name: 'Painel', icon: LayoutDashboard, page: 'Dashboard' },
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
    { name: 'IVA', icon: Receipt, page: 'IVA', adminOnly: true },
    { name: 'Empréstimos', icon: Wallet, page: 'Loans' },
    { name: 'Ajustamentos', icon: Receipt, page: 'Reimbursements' },
    { name: 'Indicações', icon: HandCoins, page: 'Referrals' },
    { name: 'Compra veículos', icon: ShoppingCart, page: 'VehiclePurchases' },
  ]},
  { section: 'Desempenho', items: [
    { name: 'Classificação', icon: FileBarChart, page: 'Rankings' },
    { name: 'UPI', icon: Coins, page: 'UPI', adminDriverOnly: true },
    { name: 'Relatórios', icon: FileBarChart, page: 'Relatorios' },
    { name: 'Relatório Frota', icon: PieChart, page: 'RelatoriosFrota' },
    { name: 'Mensagens', icon: MessageCircle, page: 'Messaging' },
    { name: 'Notificações', icon: Bell, page: 'Notifications' },
    { name: 'Dashboard Motorista', icon: LayoutDashboard, page: 'DriverDashboard' },
  ]},
];

export default function Sidebar({ currentPage, userRole }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Support multi-roles (comma-separated)
  const roles = userRole ? userRole.split(',').map(r => r.trim()) : [];
  const hasRole = (r) => roles.includes(r);

  const filteredNav = NAV_ITEMS.map(section => ({
    ...section,
    items: section.items.filter(item => {
    if (item.adminOnly && !hasRole('admin')) return false;
    if (hasRole('admin')) return true;
      if (item.adminDriverOnly && !hasRole('admin') && !hasRole('driver')) return false;
      if (hasRole('fleet_manager') && !hasRole('driver')) {
        return ['DriverDashboard', 'Drivers', 'Vehicles', 'VehicleDetail', 'Fleets', 'Documents', 'Payments', 'Referrals', 'RelatoriosFrota', 'Rankings', 'Messaging', 'FleetManagers', 'Notifications', 'Relatorios'].includes(item.page);
      }
      if (hasRole('driver')) {
        return ['DriverDashboard', 'Documents', 'Loans', 'Reimbursements', 'Rankings', 'UPI', 'VehiclePurchases', 'Messaging', 'Notifications'].includes(item.page);
      }
      return true;
    })
  })).filter(section => section.items.length > 0);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className={cn("flex items-center gap-3 px-5 py-6 border-b border-indigo-500/20", collapsed && "justify-center px-3")}>
        {collapsed ? (
          <img 
            src="/uploads/Logo%20PureDriveWhite.png" 
            alt="PureDrive" 
            className="h-9 w-auto object-contain"
            onError={(e) => {
              e.target.outerHTML = '<div class="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"><span class="text-white font-bold text-sm">PD</span></div>';
            }}
          />
        ) : (
          <>
            <img 
              src="/uploads/Logo%20PureDriveWhite.png" 
              alt="PureDrive" 
              className="h-10 w-auto object-contain"
              onError={(e) => {
                e.target.outerHTML = '<div class="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"><span class="text-white font-bold text-sm">PD</span></div>';
              }}
            />
            <div>
              <h1 className="text-white font-semibold text-base tracking-tight">PureDrive<sup className="text-[10px]">PT</sup></h1>
              <p className="text-indigo-300 text-[11px]">Gestão de Frota</p>
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {filteredNav.map(section => (
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
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-indigo-600 text-white rounded-lg shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div className="w-64 h-full bg-gradient-to-b from-indigo-950 to-slate-900" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col h-screen bg-gradient-to-b from-indigo-950 to-slate-900 fixed left-0 top-0 z-40 transition-all duration-300",
        collapsed ? "w-[68px]" : "w-60"
      )}>
        {sidebarContent}
      </aside>
    </>
  );
}