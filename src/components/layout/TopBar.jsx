import React, { useState } from 'react';
import { Bell, LogOut, User, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { base44 } from '@/api/base44Client';

export default function TopBar({ user, pageTitle }) {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'pt');
  
  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'PD';

  const roleLabels = {
    pt: {
      admin: 'Administrador',
      fleet_manager: 'Gestor de frota',
      commercial: 'Comercial',
      driver: 'Motorista'
    },
    fr: {
      admin: 'Administrateur',
      fleet_manager: 'Gestionnaire de flotte',
      commercial: 'Commercial',
      driver: 'Chauffeur'
    }
  };

  const toggleLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
    window.location.reload();
  };

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="pl-10 lg:pl-0">
        <h2 className="text-lg font-semibold text-gray-900 tracking-tight">{pageTitle}</h2>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-gray-600 hover:text-gray-900">
              <Languages className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">{lang}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toggleLang('pt')} className={lang === 'pt' ? 'bg-indigo-50' : ''}>
              🇵🇹 Português
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleLang('fr')} className={lang === 'fr' ? 'bg-indigo-50' : ''}>
              🇫🇷 Français
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-gray-600">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 pl-3 pr-1 py-1 rounded-full hover:bg-gray-50 transition-colors">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900 leading-tight">{user?.full_name || (lang === 'pt' ? 'Utilizador' : 'Utilisateur')}</p>
                <p className="text-[11px] text-gray-500">{roleLabels[lang]?.[user?.role] || 'Admin'}</p>
              </div>
              <Avatar className="w-8 h-8 bg-indigo-100">
                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2 text-gray-600">
              <User className="w-4 h-4" /> {lang === 'pt' ? 'Meu perfil' : 'Mon profil'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-red-600" onClick={() => base44.auth.logout()}>
              <LogOut className="w-4 h-4" /> {lang === 'pt' ? 'Sair' : 'Déconnexion'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}