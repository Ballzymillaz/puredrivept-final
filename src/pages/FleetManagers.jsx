import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Car, ChevronRight } from 'lucide-react';

export default function FleetManagers({ currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedFleet, setSelectedFleet] = useState(null);
  const qc = useQueryClient();
  const isAdmin = currentUser?.role?.includes('admin');

  const { data: managers = [], isLoading } = useQuery({
    queryKey: ['fleet-managers'],
    queryFn: () => base44.entities.FleetManager.list('-created_date'),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const assignDriverMutation = useMutation({
    mutationFn: ({ driverId, managerId, managerName }) =>
      base44.entities.Driver.update(driverId, { fleet_manager_id: managerId, fleet_manager_name: managerName }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
  });
  const unassignDriverMutation = useMutation({
    mutationFn: (driverId) => base44.entities.Driver.update(driverId, { fleet_manager_id: '', fleet_manager_name: '' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
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

  const columns = [
    {
      header: 'Gestor', render: (r) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{r.full_name}</p>
          <p className="text-xs text-gray-500">{r.email}</p>
        </div>
      ),
    },
    { header: 'Telefone', accessor: 'phone' },
    { header: 'Código indicação', render: (r) => <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{r.referral_code || '—'}</span> },
    { header: 'Motoristas', render: (r) => {
      const count = drivers.filter(d => d.fleet_manager_id === r.id).length;
      return <Badge className="bg-indigo-100 text-indigo-700 border-0">{count}</Badge>;
    }},
    { header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
    { header: '', render: (r) => <button onClick={(e) => { e.stopPropagation(); setSelectedFleet(r); }} className="text-indigo-600 hover:underline text-xs flex items-center gap-1">Ver frota <ChevronRight className="w-3 h-3" /></button> },
  ];

  const fleetDrivers = selectedFleet ? drivers.filter(d => d.fleet_manager_id === selectedFleet.id) : [];
  const unassignedDrivers = drivers.filter(d => !d.fleet_manager_id);

  return (
    <div className="space-y-4">
      <PageHeader title="Gestores de frota" subtitle={`${managers.length} gestores`} actionLabel={isAdmin ? "Adicionar" : undefined} onAction={isAdmin ? () => openForm(null) : undefined} />
      <DataTable columns={columns} data={managers} isLoading={isLoading} onRowClick={isAdmin ? openForm : undefined} />

      {/* Fleet detail panel */}
      {selectedFleet && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                Motoristas — {selectedFleet.full_name}
              </CardTitle>
              <button onClick={() => setSelectedFleet(null)} className="text-xs text-gray-400 hover:text-gray-600">Fechar</button>
            </CardHeader>
            <CardContent className="p-0">
              {fleetDrivers.length === 0 ? (
                <p className="text-center py-6 text-sm text-gray-400">Nenhum motorista associado</p>
              ) : (
                fleetDrivers.map(d => (
                  <div key={d.id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{d.full_name}</p>
                      <p className="text-xs text-gray-400">{d.assigned_vehicle_plate || 'Sem veículo'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={d.status} />
                      {isAdmin && (
                        <button onClick={() => unassignDriverMutation.mutate(d.id)} className="text-xs text-red-400 hover:underline">Desassociar</button>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isAdmin && unassignedDrivers.length > 0 && (
                <div className="px-4 py-3 bg-gray-50 border-t">
                  <p className="text-xs font-medium text-gray-500 mb-2">Associar motorista:</p>
                  <div className="flex gap-2">
                    <Select onValueChange={v => assignDriverMutation.mutate({ driverId: v, managerId: selectedFleet.id, managerName: selectedFleet.full_name })}>
                      <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Escolher motorista..." /></SelectTrigger>
                      <SelectContent>{unassignedDrivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Car className="w-4 h-4 text-indigo-500" />
                Resumo da frota
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Total motoristas</span><span className="font-medium">{fleetDrivers.length}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Motoristas ativos</span><span className="font-medium text-green-600">{fleetDrivers.filter(d => d.status === 'active').length}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Código indicação</span><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{selectedFleet.referral_code || '—'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Email</span><span className="text-xs">{selectedFleet.email}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Estado</span><StatusBadge status={selectedFleet.status} /></div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo gestor'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm(f => ({...f, full_name: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Telefone *</Label><Input value={form.phone} onChange={(e) => setForm(f => ({...f, phone: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">NIF</Label><Input value={form.nif} onChange={(e) => setForm(f => ({...f, nif: e.target.value}))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">IBAN</Label><Input value={form.iban} onChange={(e) => setForm(f => ({...f, iban: e.target.value}))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Estado</Label>
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
            <div className="space-y-1.5"><Label className="text-xs">Notas</Label><Textarea value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} rows={2} /></div>
            <div className="flex justify-end"><Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">{editing ? 'Atualizar' : 'Criar'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}