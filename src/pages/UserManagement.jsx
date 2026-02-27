import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Users } from 'lucide-react';
import { format } from 'date-fns';

const ALL_ROLES = [
  { value: 'admin', label: 'Administrador', color: 'bg-red-100 text-red-700' },
  { value: 'fleet_manager', label: 'Gestor de frota', color: 'bg-blue-100 text-blue-700' },
  { value: 'commercial', label: 'Comercial', color: 'bg-green-100 text-green-700' },
  { value: 'driver', label: 'Motorista', color: 'bg-indigo-100 text-indigo-700' },
];

// Roles that should never appear as assignable options
const EXCLUDED_ROLES = ['user'];

export default function UserManagement({ currentUser }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoles, setInviteRoles] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const qc = useQueryClient();

  const isAdmin = currentUser?.role?.includes('admin');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date'),
  });

  // Filter users by search and role
  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const matchSearch = !searchQuery || 
      user.full_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower);
    
    const matchRole = roleFilter === 'all' || 
      (user.role && user.role.split(',').map(r => r.trim()).includes(roleFilter));
    
    return matchSearch && matchRole;
  });

  const handleInvite = async () => {
    const platformRole = inviteRoles.includes('admin') ? 'admin' : 'user';
    await base44.users.inviteUser(inviteEmail, platformRole);
    setShowInvite(false);
    setInviteEmail('');
    setInviteRoles([]);
  };

  const getRoleBadges = (roleStr) => {
    if (!roleStr) return null;
    const roles = roleStr.split(',').map(r => r.trim()).filter(r => r && !EXCLUDED_ROLES.includes(r));
    if (roles.length === 0) return <Badge className="text-xs bg-gray-100 text-gray-500 border-0">Sem role</Badge>;
    return roles.map(r => {
      const cfg = ALL_ROLES.find(ar => ar.value === r);
      return <Badge key={r} className={`text-xs border-0 mr-1 ${cfg?.color || 'bg-gray-100 text-gray-500'}`}>{cfg?.label || r}</Badge>;
    });
  };

  const columns = [
    {
      header: 'Utilizador',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
            {r.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-medium text-sm text-gray-900">{r.full_name}</p>
            <p className="text-xs text-gray-400">{r.email}</p>
          </div>
        </div>
      )
    },
    { header: 'Roles', render: (r) => <div className="flex flex-wrap gap-1">{getRoleBadges(r.role)}</div> },
    { header: 'Membro desde', render: (r) => <span className="text-xs text-gray-500">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy') : '—'}</span> },
  ];

  if (!isAdmin) {
    return <div className="p-8 text-center text-gray-400">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Gestão de Utilizadores" subtitle={`${filteredUsers.length} de ${users.length} utilizadores`}>
        <Button onClick={() => setShowInvite(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Users className="w-4 h-4" /> Convidar utilizador
        </Button>
      </PageHeader>

      <div className="bg-white rounded-lg border shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Pesquisar por nome, email..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setRoleFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              roleFilter === 'all' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {ALL_ROLES.map(role => (
            <button
              key={role.value}
              onClick={() => setRoleFilter(role.value)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                roleFilter === role.value 
                  ? `${role.color}` 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredUsers}
        isLoading={isLoading}
        emptyMessage="Nenhum utilizador"
      />

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Convidar novo utilizador</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="utilizador@email.com" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Roles iniciais</Label>
              {ALL_ROLES.map(role => (
                <label key={role.value} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${inviteRoles.includes(role.value) ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={inviteRoles.includes(role.value)} onChange={() => setInviteRoles(prev => prev.includes(role.value) ? prev.filter(r => r !== role.value) : [...prev, role.value])} className="w-4 h-4 accent-indigo-600" />
                  <span className="text-sm">{role.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400">O utilizador receberá um email com link de acesso.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleInvite} disabled={!inviteEmail}>
                Enviar convite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}