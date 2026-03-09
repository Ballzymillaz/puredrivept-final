import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wrench, Plus, AlertTriangle, CheckCircle2, Clock, Euro, Search, Calendar } from 'lucide-react';
import { format, isPast, isToday, addDays } from 'date-fns';

const TYPE_LABELS = {
  preventive: 'Preventiva',
  corrective: 'Corretiva',
  oil_change: 'Óleo',
  tire: 'Pneus',
  brake: 'Travões',
  inspection: 'Inspeção',
  repair: 'Reparação',
  cleaning: 'Limpeza',
  other: 'Outro',
};

const STATUS_CONFIG = {
  done: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700' },
  scheduled: { label: 'Agendada', color: 'bg-blue-100 text-blue-700' },
  overdue: { label: 'Em atraso', color: 'bg-red-100 text-red-700' },
};

function computeStatus(record) {
  if (record.status === 'done') return 'done';
  if (!record.next_service_date) return record.status || 'done';
  const d = new Date(record.next_service_date);
  if (isPast(d) && !isToday(d)) return 'overdue';
  return 'scheduled';
}

export default function Maintenance({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';
  const isFleetManager = currentUser?.role === 'fleet_manager';
  const canWrite = isAdmin || isFleetManager;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const qc = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => base44.entities.MaintenanceRecord.list('-service_date', 200),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.MaintenanceRecord.create(d),
    onSuccess: async (rec) => {
      // Also add cost as vehicle expense
      if (rec.cost > 0) {
        await base44.entities.Expense.create({
          category: 'maintenance',
          description: `${TYPE_LABELS[rec.type] || rec.type} — ${rec.vehicle_info || rec.vehicle_id}`,
          amount: rec.cost,
          date: rec.service_date,
          vehicle_id: rec.vehicle_id,
          notes: rec.notes || '',
        });
      }
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      qc.invalidateQueries({ queryKey: ['expenses-all'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MaintenanceRecord.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MaintenanceRecord.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }),
  });

  const enriched = useMemo(() => records.map(r => ({ ...r, _status: computeStatus(r) })), [records]);

  const filtered = enriched.filter(r => {
    const matchSearch = !search || r.vehicle_info?.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase());
    const matchVehicle = vehicleFilter === 'all' || r.vehicle_id === vehicleFilter;
    const matchStatus = statusFilter === 'all' || r._status === statusFilter;
    return matchSearch && matchVehicle && matchStatus;
  });

  const overdueCount = enriched.filter(r => r._status === 'overdue').length;
  const scheduledCount = enriched.filter(r => r._status === 'scheduled').length;
  const totalCost = enriched.reduce((s, r) => s + (r.cost || 0), 0);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const openEdit = (rec) => { setEditing(rec); setShowForm(true); };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-indigo-600" /> Manutenção de Veículos
          </h1>
          <p className="text-sm text-gray-500">Gestão de manutenções preventivas e corretivas</p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Plus className="w-4 h-4" /> Nova manutenção
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{records.length}</p>
                <p className="text-xs text-gray-500">Total registos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-red-600">{overdueCount}</p>
                <p className="text-xs text-gray-500">Em atraso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600">{scheduledCount}</p>
                <p className="text-xs text-gray-500">Agendadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Euro className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-600">{fmt(totalCost)}</p>
                <p className="text-xs text-gray-500">Custo total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue alert banner */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{overdueCount} manutenção(ões) em atraso</strong> — verifique os registos assinalados.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Pesquisar veículo ou descrição..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todos os veículos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os veículos</SelectItem>
            {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} - {v.license_plate}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="done">Concluída</SelectItem>
            <SelectItem value="scheduled">Agendada</SelectItem>
            <SelectItem value="overdue">Em atraso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Records */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-12 text-sm">A carregar...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum registo encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(rec => {
            const statusCfg = STATUS_CONFIG[rec._status] || STATUS_CONFIG.done;
            return (
              <Card key={rec.id} className={`border shadow-sm hover:shadow-md transition-shadow cursor-pointer ${rec._status === 'overdue' ? 'border-red-200 bg-red-50/30' : ''}`} onClick={() => canWrite && openEdit(rec)}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{rec.vehicle_info || rec.vehicle_id}</p>
                      <p className="text-xs text-gray-500">{TYPE_LABELS[rec.type] || rec.type}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
                  </div>
                  {rec.description && <p className="text-xs text-gray-600 line-clamp-2">{rec.description}</p>}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Calendar className="w-3 h-3" />
                      {rec.service_date ? format(new Date(rec.service_date), 'dd/MM/yyyy') : '—'}
                    </div>
                    {rec.cost > 0 && (
                      <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <Euro className="w-3 h-3" /> {(rec.cost || 0).toFixed(2)}
                      </div>
                    )}
                    {rec.mileage_at_service && (
                      <div className="text-gray-500">{rec.mileage_at_service.toLocaleString()} km</div>
                    )}
                    {rec.next_service_date && (
                      <div className={`flex items-center gap-1 ${rec._status === 'overdue' ? 'text-red-600 font-semibold' : 'text-blue-600'}`}>
                        <Clock className="w-3 h-3" />
                        Próx: {format(new Date(rec.next_service_date), 'dd/MM/yyyy')}
                      </div>
                    )}
                    {rec.next_service_mileage && (
                      <div className="text-blue-600">Próx: {rec.next_service_mileage.toLocaleString()} km</div>
                    )}
                  </div>
                  {rec.performed_by && <p className="text-xs text-gray-400">Executado por: {rec.performed_by}</p>}
                  {canWrite && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={(e) => { e.stopPropagation(); openEdit(rec); }}>Editar</Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs h-7 text-red-500" onClick={(e) => { e.stopPropagation(); if (confirm('Eliminar registo?')) deleteMutation.mutate(rec.id); }}>Eliminar</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar manutenção' : 'Nova manutenção'}</DialogTitle>
          </DialogHeader>
          <MaintenanceForm
            initial={editing}
            vehicles={vehicles}
            onSubmit={(data) => {
              if (editing) updateMutation.mutate({ id: editing.id, data });
              else createMutation.mutate(data);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MaintenanceForm({ initial, vehicles, onSubmit, isLoading, onCancel }) {
  const [form, setForm] = useState({
    vehicle_id: initial?.vehicle_id || '',
    type: initial?.type || 'preventive',
    description: initial?.description || '',
    cost: initial?.cost || '',
    mileage_at_service: initial?.mileage_at_service || '',
    service_date: initial?.service_date || new Date().toISOString().split('T')[0],
    next_service_date: initial?.next_service_date || '',
    next_service_mileage: initial?.next_service_mileage || '',
    performed_by: initial?.performed_by || '',
    status: initial?.status || 'done',
    notes: initial?.notes || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const vehicle = vehicles.find(v => v.id === form.vehicle_id);
    onSubmit({
      ...form,
      vehicle_info: vehicle ? `${vehicle.brand} ${vehicle.model} - ${vehicle.license_plate}` : '',
      cost: parseFloat(form.cost) || 0,
      mileage_at_service: parseFloat(form.mileage_at_service) || undefined,
      next_service_mileage: parseFloat(form.next_service_mileage) || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Veículo *</Label>
        <Select value={form.vehicle_id} onValueChange={v => set('vehicle_id', v)} required>
          <SelectTrigger><SelectValue placeholder="Selecionar veículo..." /></SelectTrigger>
          <SelectContent>
            {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} - {v.license_plate}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo *</Label>
          <Select value={form.type} onValueChange={v => set('type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Estado</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="done">Concluída</SelectItem>
              <SelectItem value="scheduled">Agendada</SelectItem>
              <SelectItem value="overdue">Em atraso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data serviço *</Label>
          <Input type="date" value={form.service_date} onChange={e => set('service_date', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Custo (€)</Label>
          <Input type="number" step="0.01" placeholder="0.00" value={form.cost} onChange={e => set('cost', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Km no serviço</Label>
          <Input type="number" placeholder="ex: 45000" value={form.mileage_at_service} onChange={e => set('mileage_at_service', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Executado por</Label>
          <Input placeholder="Oficina / técnico" value={form.performed_by} onChange={e => set('performed_by', e.target.value)} />
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-gray-600 mb-3">Alertas para próxima manutenção</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Data próxima manutenção</Label>
            <Input type="date" value={form.next_service_date} onChange={e => set('next_service_date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Km próxima manutenção</Label>
            <Input type="number" placeholder="ex: 60000" value={form.next_service_mileage} onChange={e => set('next_service_mileage', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Descrição</Label>
        <Textarea placeholder="Descrição do trabalho realizado..." value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notas internas</Label>
        <Textarea placeholder="Notas..." value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" disabled={isLoading || !form.vehicle_id} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
          {isLoading ? 'A guardar...' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}