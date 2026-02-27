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

export default function UserManagement({ currentUser }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoles, setInviteRoles] = useState(['user']);
  const [showInvite, setShowInvite] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const qc = useQueryClient();

  const isAdmin = currentUser?.role?.includes('admin');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, role }) => base44.entities.User.update(id, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); setEditing(null); },
  });

  const openEdit = (user) => {
    setEditing(user);
    const roles = user.role ? user.role.split(',').map(r => r.trim()).filter(Boolean) : [];
    setSelectedRoles(roles);
    setShowForm(true);
  };

  const toggleRole = (role) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSave = () => {
    const role = selectedRoles.join(',') || 'user';
    updateMutation.mutate({ id: editing.id, role });
  };

  const handleInvite = async () => {
    const role = inviteRoles.join(',') || 'user';
    await base44.users.inviteUser(inviteEmail, role === 'admin' ? 'admin' : 'user');
    setShowInvite(false);
    setInviteEmail('');
    setInviteRoles(['user']);
  };

  const getRoleBadges = (roleStr) => {
    if (!roleStr) return <Badge className="text-xs bg-gray-100 text-gray-500 border-0">user</Badge>;
    const roles = roleStr.split(',').map(r => r.trim()).filter(Boolean);
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
      <PageHeader title="Gestão de Utilizadores" subtitle={`${users.length} utilizadores`}>
        <Button onClick={() => setShowInvite(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Users className="w-4 h-4" /> Convidar utilizador
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyMessage="Nenhum utilizador"
      />

      {/* Edit roles dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500" />
              Editar roles — {editing?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Seleciona os roles do utilizador. Múltiplos roles são permitidos.</p>
            <div className="space-y-2">
              {ALL_ROLES.map(role => (
                <label key={role.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedRoles.includes(role.value) ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.value)}
                    onChange={() => toggleRole(role.value)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{role.label}</p>
                    <p className="text-xs text-gray-400">
                      {role.value === 'admin' && 'Acesso total à plataforma'}
                      {role.value === 'fleet_manager' && 'Gestão de motoristas e veículos'}
                      {role.value === 'commercial' && 'Indicações e referências'}
                      {role.value === 'driver' && 'Dashboard do motorista'}
                    </p>
                  </div>
                  <Badge className={`${role.color} border-0 text-xs`}>{role.label}</Badge>
                </label>
              ))}
            </div>
            {selectedRoles.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-xs text-gray-500 mb-1">Roles resultantes:</p>
                <p className="font-mono text-xs text-indigo-700">{selectedRoles.join(', ')}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'A guardar...' : 'Guardar roles'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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