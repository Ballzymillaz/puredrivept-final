import React, { useState } from 'react';
import { Bell, LogOut, User, Languages, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { useSimulation } from '@/components/shared/SimulationContext';

export default function TopBar({ user, pageTitle }) {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'pt');
  const [showSimDialog, setShowSimDialog] = useState(false);
  const [simRole, setSimRole] = useState('driver');
  const [simTargetId, setSimTargetId] = useState('');
  const { simulation, setSimulation } = useSimulation();
  const myEmail = user?.email;
  const isAdmin = user?.role === 'admin';

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 50),
    enabled: !!myEmail,
    refetchInterval: 30000,
  });
  const { data: allDrivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
    enabled: isAdmin && showSimDialog,
  });
  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleet-managers'],
    queryFn: () => base44.entities.FleetManager.list(),
    enabled: isAdmin && showSimDialog,
  });

  const unreadCount = notifications.filter(n => {
    const isVisible = (n.recipient_email === myEmail) || (n.recipient_role === 'all') || (n.recipient_role === user?.role) || user?.role === 'admin';
    return isVisible && !n.read_by?.includes(myEmail);
  }).length;

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'PD';

  const roleLabels = {
    pt: { admin: 'Administrador', fleet_manager: 'Gestor de frota', driver: 'Motorista' },
    fr: { admin: 'Administrateur', fleet_manager: 'Gestionnaire de flotte', driver: 'Chauffeur' }
  };

  const toggleLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
    window.location.reload();
  };

  const handleActivateSimulation = () => {
    const targets = simRole === 'driver' ? allDrivers : fleetManagers;
    const target = targets.find(t => t.id === simTargetId);
    if (!target) return;
    setSimulation({ role: simRole, targetId: simTargetId, targetName: target.full_name });
    setShowSimDialog(false);
  };

  const targetList = simRole === 'driver' ? allDrivers : fleetManagers;

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="pl-10 lg:pl-0">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">{pageTitle}</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Simulation button — admin only */}
          {isAdmin && (
            simulation ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 text-xs"
                onClick={() => setSimulation(null)}
              >
                <EyeOff className="w-3.5 h-3.5" />
                Sair simulação
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-gray-600 text-xs"
                onClick={() => setShowSimDialog(true)}
              >
                <Eye className="w-3.5 h-3.5" />
                Simular
              </Button>
            )
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-gray-600 hover:text-gray-900">
                <Languages className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">{lang}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toggleLang('pt')} className={lang === 'pt' ? 'bg-indigo-50' : ''}>🇵🇹 Português</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleLang('fr')} className={lang === 'fr' ? 'bg-indigo-50' : ''}>🇫🇷 Français</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link to={createPageUrl('Notifications')}>
            <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-gray-600">
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 pl-3 pr-1 py-1 rounded-full hover:bg-gray-50 transition-colors">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900 leading-tight">{user?.full_name || 'Utilizador'}</p>
                  <p className="text-[11px] text-gray-500">{roleLabels[lang]?.[user?.role] || 'Admin'}</p>
                </div>
                <Avatar className="w-8 h-8 bg-indigo-100">
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2 text-gray-600"><User className="w-4 h-4" /> Meu perfil</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-red-600" onClick={() => base44.auth.logout()}>
                <LogOut className="w-4 h-4" /> {lang === 'pt' ? 'Sair' : 'Déconnexion'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Simulation dialog */}
      {isAdmin && (
        <Dialog open={showSimDialog} onOpenChange={setShowSimDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="w-4 h-4" /> Modo Simulação</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Visualize a aplicação como um utilizador específico. Todas as ações críticas ficam bloqueadas.</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Tipo de utilizador</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSimRole('driver'); setSimTargetId(''); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${simRole === 'driver' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    Motorista
                  </button>
                  <button
                    onClick={() => { setSimRole('fleet_manager'); setSimTargetId(''); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${simRole === 'fleet_manager' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    Fleet Manager
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">{simRole === 'driver' ? 'Motorista' : 'Gestor de frota'}</label>
                <Select value={simTargetId} onValueChange={setSimTargetId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {targetList.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSimDialog(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleActivateSimulation} disabled={!simTargetId} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                  Ativar simulação
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}