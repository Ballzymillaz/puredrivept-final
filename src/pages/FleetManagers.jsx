import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatusBadge from '../components/shared/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Users, Car, Building2, Plus, Edit, Power, Search, AlertTriangle } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import CreateFleetManagerDialog from '../components/fleet_managers/CreateFleetManagerDialog';

export default function FleetManagers({ currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const isAdmin = currentUser?.role?.includes('admin');

  // Access guard
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400">
        <AlertTriangle className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-lg font-medium">Acesso restrito</p>
        <p className="text-sm">Esta página é apenas para administradores.</p>
      </div>
    );
  }

  const { data: managers = [], isLoading } = useQuery({
    queryKey: ['fleet-managers'],
    queryFn: () => base44.entities.FleetManager.list('-created_date'),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-all'],
    queryFn: () => base44.entities.Driver.list(),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-all'],
    queryFn: () => base44.entities.Vehicle.list(),
  });
  const { data: fleets = [] } = useQuery({
    queryKey: ['fleets'],
    queryFn: () => base44.entities.Fleet.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.FleetManager.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-managers'] }); setShowForm(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FleetManager.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-managers'] }); setShowForm(false); setEditing(null); },
  });

  const [form, setForm] = useState({});
  const openForm = (mgr) => {
    setEditing(mgr);
    setForm({
      full_name: mgr?.full_name || '', email: mgr?.email || '', phone: mgr?.phone || '',
      nif: mgr?.nif || '', iban: mgr?.iban || '', status: mgr?.status || 'pending',
      referral_code: mgr?.referral_code || '', notes: mgr?.notes || '',
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate({ ...form, referral_code: form.referral_code || `FM-${Date.now().toString(36).toUpperCase()}` });
  };

  const toggleStatus = (mgr) => {
    const newStatus = mgr.status === 'active' ? 'inactive' : 'active';
    updateMutation.mutate({ id: mgr.id, data: { status: newStatus } });
  };

  const filteredManagers = managers.filter(m =>
    !search || m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase())
  );

  // KPIs
  const totalFleets = fleets.length;
  const totalDriversManaged = drivers.filter(d => d.fleet_manager_id).length;
  const inactiveManagers = managers.filter(m => m.status === 'inactive').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestores de Frota</h1>
          <p className="text-sm text-gray-500">Centro de controlo organizacional</p>
        </div>
        <Button onClick={() => openForm(null)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="w-4 h-4" /> Adicionar gestor
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{managers.length}</p>
            <p className="text-xs text-gray-500">Total gestores</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalFleets}</p>
            <p className="text-xs text-gray-500">Total frotas</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Car className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalDriversManaged}</p>
            <p className="text-xs text-gray-500">Motoristas geridos</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{inactiveManagers}</p>
            <p className="text-xs text-gray-500">Gestores inativos</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Pesquisar gestor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-400 text-sm">A carregar...</div>
      ) : filteredManagers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum gestor encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredManagers.map(mgr => {
            const mgrDrivers = drivers.filter(d => d.fleet_manager_id === mgr.id);
            const mgrVehicles = vehicles.filter(v => v.fleet_manager_id === mgr.id);
            const mgrFleets = fleets.filter(f => f.fleet_manager_id === mgr.id);
            const hasNoDrivers = mgrDrivers.length === 0;

            return (
              <div
                key={mgr.id}
                className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-4 ${hasNoDrivers ? 'border-orange-200' : ''}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                      {mgr.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{mgr.full_name}</p>
                      <p className="text-xs text-gray-400">{mgr.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={`text-xs border-0 ${mgr.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {mgr.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {hasNoDrivers && (
                      <Badge className="text-xs border-0 bg-red-100 text-red-600">Sem motoristas</Badge>
                    )}
                  </div>
                </div>

                {/* Phone */}
                <p className="text-xs text-gray-500">{mgr.phone || '—'}</p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-indigo-700">{mgrFleets.length}</p>
                    <p className="text-[10px] text-gray-500">Frotas</p>
                  </div>
                  <div className="text-center border-x border-gray-200">
                    <p className="text-lg font-bold text-gray-800">{mgrDrivers.length}</p>
                    <p className="text-[10px] text-gray-500">Motoristas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-800">{mgrVehicles.length}</p>
                    <p className="text-[10px] text-gray-500">Veículos</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Link
                    to={createPageUrl('Fleets')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  >
                    <Building2 className="w-3.5 h-3.5" /> Ver frotas
                  </Link>
                  <button
                    onClick={() => openForm(mgr)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => toggleStatus(mgr)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      mgr.status === 'active'
                        ? 'text-red-500 border-red-200 hover:bg-red-50'
                        : 'text-green-600 border-green-200 hover:bg-green-50'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {mgr.status === 'active' ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar gestor' : 'Novo gestor de frota'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Nome completo *</Label>
                <Input value={form.full_name} onChange={(e) => setForm(f => ({...f, full_name: e.target.value}))} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone *</Label>
                <Input value={form.phone} onChange={(e) => setForm(f => ({...f, phone: e.target.value}))} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">NIF</Label>
                <Input value={form.nif} onChange={(e) => setForm(f => ({...f, nif: e.target.value}))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">IBAN</Label>
                <Input value={form.iban} onChange={(e) => setForm(f => ({...f, iban: e.target.value}))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({...f, status: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Frotas assignment */}
            {fleets.length > 0 && (
              <div>
                <Label className="text-xs mb-2 block">Frotas associadas ({fleets.filter(f => f.fleet_manager_id === editing?.id).length} atuais)</Label>
                <div className="border rounded-lg max-h-36 overflow-y-auto divide-y">
                  {fleets.map(fleet => {
                    const isAssigned = fleet.fleet_manager_id === editing?.id;
                    const fleetDriverCount = drivers.filter(d => d.fleet_id === fleet.id).length;
                    return (
                      <div key={fleet.id} className={`flex items-center justify-between px-3 py-2 text-sm ${isAssigned ? 'bg-indigo-50' : ''}`}>
                        <div>
                          <span className="font-medium">{fleet.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{fleetDriverCount} motoristas</span>
                        </div>
                        {isAssigned && <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-0">Atribuída</Badge>}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1">Para alterar frotas, use a página Frotas.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                {editing ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}