import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Wrench, CreditCard, AlertTriangle, Car, Plus, Trash2, User } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { differenceInDays, format } from 'date-fns';
import StatusBadge from '../components/shared/StatusBadge';

const MAINT_LABELS = {
  oil_change: 'Mudança de óleo', tire: 'Pneus', brake: 'Travões',
  inspection: 'Inspeção', repair: 'Reparação', cleaning: 'Limpeza',
  fuel: 'Combustível', other: 'Outro'
};

const fmt = (n) => `€${(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-PT') : '—';

export default function VehicleDetail({ currentUser }) {
  const urlParams = new URLSearchParams(window.location.search);
  const vehicleId = urlParams.get('id');
  const qc = useQueryClient();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.hasRole?.('admin');
  const isFleetManager = currentUser?.role === 'fleet_manager' || currentUser?.hasRole?.('fleet_manager');
  const canEditMaintenance = isAdmin || isFleetManager;

  const [showMaintForm, setShowMaintForm] = useState(false);
  const [editingMaint, setEditingMaint] = useState(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [maintForm, setMaintForm] = useState({
    type: 'repair', description: '', cost: '', mileage_at_service: '',
    service_date: new Date().toISOString().split('T')[0], next_service_date: '',
    next_service_mileage: '', performed_by: '', notes: ''
  });

  const { data: vehicle } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => base44.entities.Vehicle.filter({ id: vehicleId }).then(r => r[0]),
    enabled: !!vehicleId,
  });
  const { data: drivers = [] } = useQuery({ queryKey: ['drivers'], queryFn: () => base44.entities.Driver.list() });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.WeeklyPayment.list('-week_start') });
  const { data: maintenances = [], isLoading: maintLoading } = useQuery({
    queryKey: ['maintenance', vehicleId],
    queryFn: () => base44.entities.MaintenanceRecord.filter({ vehicle_id: vehicleId }, '-service_date'),
    enabled: !!vehicleId,
  });

  const assignedDriver = drivers.find(d => d.id === vehicle?.assigned_driver_id);
  const vehiclePayments = payments.filter(p => {
    const driver = drivers.find(d => d.id === p.driver_id);
    return driver?.assigned_vehicle_id === vehicleId;
  });

  const totalMaintCost = maintenances.reduce((s, m) => s + (m.cost || 0), 0);
  const today = new Date();
  const upcomingMaint = maintenances.filter(m => m.next_service_date && differenceInDays(new Date(m.next_service_date), today) <= 30 && differenceInDays(new Date(m.next_service_date), today) >= 0);

  // Custos analytics
  const avgMonthlyCost = useMemo(() => {
    if (!vehicle?.first_registration_date || maintenances.length === 0) return 0;
    const months = Math.max(1, differenceInDays(today, new Date(vehicle.first_registration_date)) / 30);
    return totalMaintCost / months;
  }, [vehicle, maintenances, totalMaintCost, today]);

  const lastMaintenance = maintenances.length > 0 ? maintenances[0] : null;

  const createMaintMutation = useMutation({
    mutationFn: (d) => base44.entities.MaintenanceRecord.create({ ...d, vehicle_id: vehicleId, vehicle_info: `${vehicle?.brand} ${vehicle?.model} - ${vehicle?.license_plate}` }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance', vehicleId] }); setShowMaintForm(false); resetForm(); },
  });
  const updateMaintMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MaintenanceRecord.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance', vehicleId] }); setShowMaintForm(false); setEditingMaint(null); resetForm(); },
  });
  const deleteMaintMutation = useMutation({
    mutationFn: (id) => base44.entities.MaintenanceRecord.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance', vehicleId] }),
  });
  const assignMutation = useMutation({
    mutationFn: async ({ driverId }) => {
      // Unassign previous driver if any
      if (vehicle?.assigned_driver_id) {
        await base44.entities.Driver.update(vehicle.assigned_driver_id, { assigned_vehicle_id: '', assigned_vehicle_plate: '' });
      }
      if (driverId) {
        const driver = drivers.find(d => d.id === driverId);
        await base44.entities.Driver.update(driverId, { assigned_vehicle_id: vehicleId, assigned_vehicle_plate: vehicle?.license_plate });
        await base44.entities.Vehicle.update(vehicleId, { assigned_driver_id: driverId, assigned_driver_name: driver?.full_name, status: 'assigned' });
      } else {
        await base44.entities.Vehicle.update(vehicleId, { assigned_driver_id: '', assigned_driver_name: '', status: 'available' });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] }); qc.invalidateQueries({ queryKey: ['drivers'] }); setShowAssignDialog(false); },
  });

  const resetForm = () => setMaintForm({ type: 'repair', description: '', cost: '', mileage_at_service: '', service_date: new Date().toISOString().split('T')[0], next_service_date: '', next_service_mileage: '', performed_by: '', notes: '' });

  const openMaintForm = (m) => {
    if (m) { setEditingMaint(m); setMaintForm({ type: m.type, description: m.description || '', cost: m.cost || '', mileage_at_service: m.mileage_at_service || '', service_date: m.service_date || '', next_service_date: m.next_service_date || '', next_service_mileage: m.next_service_mileage || '', performed_by: m.performed_by || '', notes: m.notes || '' }); }
    else { setEditingMaint(null); resetForm(); }
    setShowMaintForm(true);
  };

  const handleMaintSubmit = (e) => {
    e.preventDefault();
    const data = { ...maintForm, cost: parseFloat(maintForm.cost) || 0, mileage_at_service: parseFloat(maintForm.mileage_at_service) || 0, next_service_mileage: parseFloat(maintForm.next_service_mileage) || 0 };
    if (editingMaint) updateMaintMutation.mutate({ id: editingMaint.id, data });
    else createMaintMutation.mutate(data);
  };

  if (!vehicle) return <div className="p-8 text-center text-gray-400">A carregar...</div>;

  const unassignedDrivers = drivers.filter(d => !d.assigned_vehicle_id || d.assigned_vehicle_id === vehicleId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="text-gray-400 hover:text-gray-700 flex items-center gap-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center">
          <Car className="w-7 h-7 text-indigo-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-gray-500 text-sm">{vehicle.license_plate} · {vehicle.color || ''} · {vehicle.fuel_type || ''}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <StatusBadge status={vehicle.status} />
          {isAdmin && (
            <Button onClick={() => setShowAssignDialog(true)} variant="outline" size="sm" className="gap-1.5">
              <User className="w-3.5 h-3.5" />
              {assignedDriver ? 'Reatribuir' : 'Atribuir motorista'}
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {upcomingMaint.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 text-sm">Manutenção próxima</p>
            <div className="mt-1 space-y-0.5">
              {upcomingMaint.map(m => (
                <p key={m.id} className="text-xs text-amber-700">
                  {MAINT_LABELS[m.type]} — {fmtDate(m.next_service_date)} ({differenceInDays(new Date(m.next_service_date), today)} dias)
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Motorista</p><p className="font-semibold text-sm mt-0.5">{assignedDriver?.full_name || '—'}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Custo manutenção</p><p className="font-semibold text-sm mt-0.5 text-red-600">{fmt(totalMaintCost)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Km atual</p><p className="font-semibold text-sm mt-0.5">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : '—'}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Seguro até</p><p className="font-semibold text-sm mt-0.5">{fmtDate(vehicle.insurance_expiry)}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="custos">
        <TabsList>
          <TabsTrigger value="custos">Custos & Manutenção</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos ({vehiclePayments.length})</TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
        </TabsList>

        <TabsContent value="custos" className="space-y-4">
          {/* KPI summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4">
              <p className="text-xs text-gray-500">Custo total acumulado</p>
              <p className="text-xl font-bold text-red-600 mt-0.5">{fmt(totalMaintCost)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-gray-500">Custo médio mensal</p>
              <p className="text-xl font-bold text-orange-600 mt-0.5">{fmt(avgMonthlyCost)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-gray-500">Total intervenções</p>
              <p className="text-xl font-bold text-gray-800 mt-0.5">{maintenances.length}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-gray-500">Última manutenção</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{lastMaintenance ? fmtDate(lastMaintenance.service_date) : '—'}</p>
              {lastMaintenance && <p className="text-xs text-gray-400">{MAINT_LABELS[lastMaintenance.type]}</p>}
            </CardContent></Card>
          </div>

          {/* Full history table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold">Histórico completo</CardTitle>
              {canEditMaintenance && <Button size="sm" onClick={() => openMaintForm(null)} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"><Plus className="w-3.5 h-3.5" /> Adicionar</Button>}
            </CardHeader>
            <CardContent className="p-0">
              {maintLoading ? <p className="text-center py-8 text-sm text-gray-400">A carregar...</p> : maintenances.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-400">Nenhum registo de manutenção</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 border-y">
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Data</th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Tipo</th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Descrição</th>
                      <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Valor</th>
                      <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Km</th>
                      {canEditMaintenance && <th className="py-2.5 px-4"></th>}
                    </tr></thead>
                    <tbody className="divide-y">
                      {maintenances.map(m => (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-4 text-xs text-gray-500">{fmtDate(m.service_date)}</td>
                          <td className="py-2.5 px-4"><Badge className="text-xs bg-blue-100 text-blue-700 border-0">{MAINT_LABELS[m.type]}</Badge></td>
                          <td className="py-2.5 px-4 text-xs text-gray-700">{m.description || '—'}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-red-600">{fmt(m.cost)}</td>
                          <td className="py-2.5 px-4 text-right text-xs text-gray-500">{m.mileage_at_service ? `${m.mileage_at_service.toLocaleString()} km` : '—'}</td>
                          {canEditMaintenance && (
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex gap-1 justify-end">
                                <button onClick={() => openMaintForm(m)} className="p-1 text-gray-400 hover:text-indigo-600 rounded"><Wrench className="w-3.5 h-3.5" /></button>
                                {isAdmin && <button onClick={() => { if (confirm('Eliminar?')) deleteMaintMutation.mutate(m.id); }} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Histórico de Pagamentos</CardTitle></CardHeader>
            <CardContent className="p-0">
              {vehiclePayments.length === 0 ? <p className="text-center py-8 text-sm text-gray-400">Nenhum pagamento</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 border-y"><th className="text-left py-2 px-4 text-xs text-gray-500">Motorista</th><th className="text-left py-2 px-4 text-xs text-gray-500">Período</th><th className="text-right py-2 px-4 text-xs text-gray-500">Bruto</th><th className="text-right py-2 px-4 text-xs text-gray-500">Líquido</th><th className="text-center py-2 px-4 text-xs text-gray-500">Estado</th></tr></thead>
                    <tbody className="divide-y">
                      {vehiclePayments.slice(0, 20).map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="py-2 px-4 text-xs">{p.driver_name}</td>
                          <td className="py-2 px-4 text-xs text-gray-500">{p.period_label}</td>
                          <td className="py-2 px-4 text-right text-xs">{fmt(p.total_gross)}</td>
                          <td className="py-2 px-4 text-right text-xs text-green-600 font-medium">{fmt(p.net_amount)}</td>
                          <td className="py-2 px-4 text-center"><StatusBadge status={p.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardContent className="pt-5 grid grid-cols-2 gap-4 text-sm">
              {[
                ['Marca', vehicle.brand], ['Modelo', vehicle.model],
                ['Matrícula', vehicle.license_plate], ['VIN', vehicle.vin || '—'],
                ['Cor', vehicle.color || '—'], ['Combustível', vehicle.fuel_type || '—'],
                ['1ª Matrícula', fmtDate(vehicle.first_registration_date)], ['Km', vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : '—'],
                ['Inspeção até', fmtDate(vehicle.inspection_expiry)], ['Seguro até', fmtDate(vehicle.insurance_expiry)],
                ['Aluguer/sem', vehicle.weekly_rental_price ? fmt(vehicle.weekly_rental_price) : '—'],
                ['Preço mercado', vehicle.market_price ? fmt(vehicle.market_price) : '—'],
              ].map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium mt-0.5">{v}</p></div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Maintenance form dialog */}
      <Dialog open={showMaintForm} onOpenChange={(o) => { setShowMaintForm(o); if (!o) setEditingMaint(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingMaint ? 'Editar registo' : 'Novo registo de manutenção'}</DialogTitle></DialogHeader>
          <form onSubmit={handleMaintSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo *</Label>
                <Select value={maintForm.type} onValueChange={v => setMaintForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(MAINT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Data *</Label><Input type="date" value={maintForm.service_date} onChange={e => setMaintForm(f => ({ ...f, service_date: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Custo (€)</Label><Input type="number" step="0.01" value={maintForm.cost} onChange={e => setMaintForm(f => ({ ...f, cost: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Km no serviço</Label><Input type="number" value={maintForm.mileage_at_service} onChange={e => setMaintForm(f => ({ ...f, mileage_at_service: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Próxima data</Label><Input type="date" value={maintForm.next_service_date} onChange={e => setMaintForm(f => ({ ...f, next_service_date: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Próximos km</Label><Input type="number" value={maintForm.next_service_mileage} onChange={e => setMaintForm(f => ({ ...f, next_service_mileage: e.target.value }))} /></div>
              <div className="col-span-2 space-y-1.5"><Label className="text-xs">Realizado por</Label><Input value={maintForm.performed_by} onChange={e => setMaintForm(f => ({ ...f, performed_by: e.target.value }))} placeholder="Oficina / técnico" /></div>
              <div className="col-span-2 space-y-1.5"><Label className="text-xs">Descrição</Label><Textarea value={maintForm.description} onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowMaintForm(false)}>Cancelar</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={createMaintMutation.isPending || updateMaintMutation.isPending}>
                {editingMaint ? 'Atualizar' : 'Guardar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign driver dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Atribuir motorista</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {assignedDriver && (
              <div className="p-3 bg-amber-50 rounded-lg text-sm">
                <p className="text-amber-800">Motorista atual: <strong>{assignedDriver.full_name}</strong></p>
              </div>
            )}
            <Select onValueChange={v => assignMutation.mutate({ driverId: v === 'none' ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Escolher motorista..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem motorista —</SelectItem>
                {unassignedDrivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            {assignMutation.isPending && <p className="text-xs text-center text-gray-400">A atribuir...</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}