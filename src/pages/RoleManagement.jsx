import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Lock, Eye, Edit2, Trash2, Plus } from 'lucide-react';

const PAGES = [
  'Dashboard', 'Drivers', 'Vehicles', 'Contracts', 'FleetManagers', 'Commercials',
  'Documents', 'Applications', 'Payments', 'CashFlow', 'IVA', 'Loans', 'Reimbursements',
  'Referrals', 'VehiclePurchases', 'Goals', 'Rankings', 'UPI', 'Relatorios',
  'DriverDashboard', 'DriverFinancialDashboard'
];

const ROLES = ['admin', 'fleet_manager', 'commercial', 'driver'];

const ACCESS_LEVELS = {
  none: { label: 'Sem acesso', color: 'bg-gray-100 text-gray-700', icon: Lock },
  read: { label: 'Leitura', color: 'bg-blue-100 text-blue-700', icon: Eye },
  write: { label: 'Leitura + Escrita', color: 'bg-green-100 text-green-700', icon: Edit2 },
};

export default function RoleManagement() {
  const [selectedRole, setSelectedRole] = useState('admin');
  const [showDialog, setShowDialog] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [formData, setFormData] = useState({ role: '', page: '', access_level: 'read' });
  const qc = useQueryClient();

  const { data: permissions = [] } = useQuery({
    queryKey: ['rolePermissions'],
    queryFn: () => base44.entities.RolePermission.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.RolePermission.create(d),
    onSuccess: (data) => { 
      qc.invalidateQueries({ queryKey: ['rolePermissions'] }); 
      setShowDialog(false); 
      setFormData({ role: '', page: '', access_level: 'read' });
      alert('Permissão criada com sucesso! Usuários desse papel precisarão fazer login novamente para aplicar a restrição.');
    },
    onError: (e) => {
      alert(`Erreur: ${e.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RolePermission.update(id, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['rolePermissions'] }); 
      setShowDialog(false); 
      setEditingPermission(null);
      alert('Permissão atualizada com sucesso!');
    },
    onError: (e) => {
      alert(`Erreur: ${e.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RolePermission.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rolePermissions'] }),
    onError: (e) => alert(`Erreur: ${e.message}`),
  });

  const handleSubmit = () => {
    if (!formData.role || !formData.page) {
      alert('Veuillez remplir tous les champs');
      return;
    }
    if (editingPermission) {
      updateMutation.mutate({ id: editingPermission.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const rolePermissions = useMemo(() => {
    return permissions.filter(p => p.role === selectedRole);
  }, [permissions, selectedRole]);

  const rolePages = useMemo(() => {
    const permMap = {};
    rolePermissions.forEach(p => { permMap[p.page] = p; });
    return PAGES.map(page => ({ page, perm: permMap[page] || null }));
  }, [rolePermissions]);

  const openEdit = (perm) => {
    setEditingPermission(perm);
    setFormData({ role: perm.role, page: perm.page, access_level: perm.access_level });
    setShowDialog(true);
  };

  const openCreate = () => {
    setEditingPermission(null);
    setFormData({ role: selectedRole, page: '', access_level: 'read' });
    setShowDialog(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Gestão de Funções e Acessos" subtitle={`${ROLES.length} funções · ${PAGES.length} páginas`} actionLabel="Adicionar Permissão" onAction={openCreate} />

      {/* Role Tabs */}
      <div className="flex gap-2 flex-wrap">
        {ROLES.map(role => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              selectedRole === role
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {role === 'admin' ? 'Admin' : role === 'fleet_manager' ? 'Gestor de Frota' : role === 'commercial' ? 'Commercial' : 'Motorista'}
          </button>
        ))}
      </div>

      {/* Permissions Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Permissões para {selectedRole}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {rolePages.map(({ page, perm }) => {
              const accessConfig = ACCESS_LEVELS[perm?.access_level || 'none'];
              const Icon = accessConfig.icon;
              return (
                <div key={page} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-full">
                      <p className="text-sm font-medium text-gray-900">{page}</p>
                      {perm?.description && <p className="text-xs text-gray-500">{perm.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${accessConfig.color} gap-1 cursor-default`}>
                      <Icon className="w-3 h-3" />
                      {accessConfig.label}
                    </Badge>
                    {perm ? (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-400 hover:text-indigo-600"
                          onClick={() => openEdit(perm)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-400 hover:text-red-600"
                          onClick={() => deleteMutation.mutate(perm.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-indigo-600"
                        onClick={() => {
                          setEditingPermission(null);
                          setFormData({ role: selectedRole, page, access_level: 'read' });
                          setShowDialog(true);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPermission ? 'Editar Permissão' : 'Adicionar Permissão'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Função</label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r} value={r}>
                      {r === 'admin' ? 'Admin' : r === 'fleet_manager' ? 'Gestor de Frota' : r === 'commercial' ? 'Commercial' : 'Motorista'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Página</label>
              <Select value={formData.page} onValueChange={(v) => setFormData({ ...formData, page: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma página" /></SelectTrigger>
                <SelectContent className="max-h-48">
                  {PAGES.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Nível de Acesso</label>
              <Select value={formData.access_level} onValueChange={(v) => setFormData({ ...formData, access_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem acesso</SelectItem>
                  <SelectItem value="read">Leitura</SelectItem>
                  <SelectItem value="write">Leitura + Escrita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}