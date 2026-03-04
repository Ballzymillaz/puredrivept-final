import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Car, Users, Building2, Edit, Trash2, Search, Coins } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import PageHeader from '../components/shared/PageHeader';

export default function Fleets({ currentUser }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingFleet, setEditingFleet] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', fleet_manager_id: '', fleet_manager_name: '', status: 'active', upi_enabled: true, vehicle_ids: [], driver_ids: [], notes: '' });

  const queryClient = useQueryClient();

  const { data: fleets = [] } = useQuery({ 
    queryKey: ['fleets'], 
    queryFn: async () => {
      const res = await base44.functions.invoke('getFleets', {});
      return res.data.fleets || [];
    },
  });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: drivers = [] } = useQuery({ queryKey: ['drivers'], queryFn: () => base44.entities.Driver.filter({ status: 'active' }) });
  const { data: fleetManagers = [] } = useQuery({ queryKey: ['fleet-managers'], queryFn: () => base44.entities.FleetManager.list() });

  const saveMutation = useMutation({
    mutationFn: (data) => editingFleet ? base44.entities.Fleet.update(editingFleet.id, data) : base44.entities.Fleet.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fleets'] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Fleet.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fleets'] }),
  });

  const openCreate = () => {
    setEditingFleet(null);
    setForm({ name: '', description: '', fleet_manager_id: '', fleet_manager_name: '', status: 'active', upi_enabled: true, vehicle_ids: [], driver_ids: [], notes: '' });
    setShowForm(true);
  };

  const openEdit = (fleet) => {
    setEditingFleet(fleet);
    setForm({ ...fleet, vehicle_ids: fleet.vehicle_ids || [], driver_ids: fleet.driver_ids || [] });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingFleet(null); };

  const handleFMChange = (id) => {
    const fm = fleetManagers.find(f => f.id === id);
    setForm(p => ({ ...p, fleet_manager_id: id, fleet_manager_name: fm?.full_name || '' }));
  };

  const toggleVehicle = (vid) => {
    setForm(p => ({
      ...p,
      vehicle_ids: p.vehicle_ids.includes(vid) ? p.vehicle_ids.filter(i => i !== vid) : [...p.vehicle_ids, vid]
    }));
  };

  const toggleDriver = (did) => {
    setForm(p => ({
      ...p,
      driver_ids: p.driver_ids.includes(did) ? p.driver_ids.filter(i => i !== did) : [...p.driver_ids, did]
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    saveMutation.mutate(form);
  };

  const filtered = fleets.filter(f => f.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <PageHeader title="Gestão de Frotas" subtitle={`${fleets.length} frotas`} actionLabel="Nova Frota" onAction={openCreate} />

      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input className="pl-9" placeholder="Pesquisar frotas..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma frota encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(fleet => {
            const fleetVehicles = vehicles.filter(v => (fleet.vehicle_ids || []).includes(v.id));
            const fleetDrivers = drivers.filter(d => (fleet.driver_ids || []).includes(d.id));
            return (
              <Card key={fleet.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">{fleet.name}</CardTitle>
                      {fleet.fleet_manager_name && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {fleet.fleet_manager_name}
                        </p>
                      )}
                    </div>
                    <Badge className={fleet.status === 'active' ? 'bg-green-100 text-green-700 border-0' : 'bg-gray-100 text-gray-600 border-0'}>
                      {fleet.status === 'active' ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fleet.description && <p className="text-xs text-gray-500">{fleet.description}</p>}
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Car className="w-4 h-4 text-indigo-500" />
                      <span className="font-semibold">{fleetVehicles.length}</span>
                      <span className="text-xs text-gray-400">veículos</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Users className="w-4 h-4 text-green-500" />
                      <span className="font-semibold">{fleetDrivers.length}</span>
                      <span className="text-xs text-gray-400">motoristas</span>
                    </div>
                  </div>
                  {fleetVehicles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {fleetVehicles.slice(0, 4).map(v => (
                      <span key={v.id} className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{v.license_plate}</span>
                    ))}
                    {fleetVehicles.length > 4 && <span className="text-[11px] text-gray-400">+{fleetVehicles.length - 4}</span>}
                  </div>
                  )}
                  <div className="flex items-center gap-1.5">
                  <Coins className={`w-3.5 h-3.5 ${fleet.upi_enabled !== false ? 'text-violet-500' : 'text-gray-300'}`} />
                  <span className={`text-xs ${fleet.upi_enabled !== false ? 'text-violet-600' : 'text-gray-400'}`}>
                    UPI {fleet.upi_enabled !== false ? 'ativado' : 'desativado'}
                  </span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEdit(fleet)}>
                      <Edit className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-500 hover:text-red-700 hover:border-red-300"
                      onClick={() => { if (confirm('Eliminar frota?')) deleteMutation.mutate(fleet.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFleet ? 'Editar Frota' : 'Nova Frota'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome da Frota *</label>
                <Input placeholder="Nome da frota" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Descrição</label>
                <Input placeholder="Descrição opcional" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Gestor de Frota</label>
                <Select value={form.fleet_manager_id} onValueChange={handleFMChange}>
                  <SelectTrigger><SelectValue placeholder="Selecionar gestor" /></SelectTrigger>
                  <SelectContent>
                    {fleetManagers.map(fm => <SelectItem key={fm.id} value={fm.id}>{fm.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Estado</label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-200">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-violet-600" />
                    <div>
                      <Label className="text-xs font-semibold text-violet-800">Sistema UPI</Label>
                      <p className="text-[11px] text-violet-600">Se ativado, UPI são gerados nos pagamentos semanais</p>
                    </div>
                  </div>
                  <Switch
                    checked={form.upi_enabled !== false}
                    onCheckedChange={v => setForm(p => ({ ...p, upi_enabled: v }))}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Veículos ({form.vehicle_ids.length} selecionados)</label>
              <div className="border rounded-lg max-h-40 overflow-y-auto divide-y">
                {vehicles.map(v => (
                  <label key={v.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={form.vehicle_ids.includes(v.id)} onChange={() => toggleVehicle(v.id)} className="rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{v.brand} {v.model}</p>
                      <p className="text-xs text-gray-400">{v.license_plate} · {v.assigned_driver_name || 'Sem motorista'}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Motoristas ({form.driver_ids.length} selecionados)</label>
              <div className="border rounded-lg max-h-40 overflow-y-auto divide-y">
                {drivers.map(d => (
                  <label key={d.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={form.driver_ids.includes(d.id)} onChange={() => toggleDriver(d.id)} className="rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{d.full_name}</p>
                      <p className="text-xs text-gray-400">{d.assigned_vehicle_plate || 'Sem veículo'}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeForm}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                {saveMutation.isPending ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}