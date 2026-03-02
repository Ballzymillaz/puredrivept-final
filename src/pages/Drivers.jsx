import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DriverForm from '../components/drivers/DriverForm';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Users, AlertTriangle, Car, ShieldAlert, MoreVertical, UserCircle, Ban, Plus } from 'lucide-react';
import { createPageUrl } from '@/utils';
import CreateDriverDialog from '../components/drivers/CreateDriverDialog';



const STATUS_LABELS = {
  active: 'Ativo', pending: 'Pendente', inactive: 'Inativo',
  evaluation: 'Avaliação', suspended: 'Suspenso',
};

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  inactive: 'bg-gray-100 text-gray-500',
  evaluation: 'bg-blue-100 text-blue-700',
  suspended: 'bg-red-100 text-red-700',
};

function getGlobalStatus(driver) {
  if (driver.status !== 'active') return 'red';
  if (!driver.vehicle_deposit_paid || !driver.assigned_vehicle_id) return 'orange';
  return 'green';
}

function GlobalStatusBadge({ driver }) {
  const s = getGlobalStatus(driver);
  if (s === 'green') return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">● OK</span>;
  if (s === 'orange') return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">● Atenção</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">● Inativo</span>;
}

export default function Drivers({ currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getDriversByFleet', {});
      return res.data.drivers || [];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleetManagers'],
    queryFn: () => base44.entities.FleetManager.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Driver.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['drivers'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Driver.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['drivers'] }); setShowForm(false); setEditingDriver(null); },
  });

  const handleSubmit = (data) => {
    if (editingDriver) updateMutation.mutate({ id: editingDriver.id, data });
    else createMutation.mutate(data);
  };

  // KPIs
  const activeDrivers = drivers.filter(d => d.status === 'active');
  const inactiveDrivers = drivers.filter(d => d.status === 'inactive' || d.status === 'suspended');
  const unpaidDeposit = drivers.filter(d => !d.vehicle_deposit_paid);
  const problemDrivers = drivers.filter(d => !d.vehicle_deposit_paid || !d.assigned_vehicle_id || d.status !== 'active');

  // Quick filter logic
  const quickFiltered = drivers.filter(d => {
    if (quickFilter === 'active') return d.status === 'active';
    if (quickFilter === 'inactive') return d.status === 'inactive' || d.status === 'suspended';
    if (quickFilter === 'unpaid') return !d.vehicle_deposit_paid;
    if (quickFilter === 'novehicle') return !d.assigned_vehicle_id;
    if (quickFilter === 'problem') return getGlobalStatus(d) !== 'green';
    return true;
  });

  const filtered = quickFiltered.filter(d =>
    !search || d.full_name?.toLowerCase().includes(search.toLowerCase()) || d.email?.toLowerCase().includes(search.toLowerCase())
  );

  const QUICK_FILTERS = [
    { key: 'all', label: 'Todos', count: drivers.length },
    { key: 'active', label: 'Ativos', count: activeDrivers.length },
    { key: 'inactive', label: 'Inativos', count: inactiveDrivers.length },
    { key: 'unpaid', label: 'Caução por pagar', count: unpaidDeposit.length },
    { key: 'novehicle', label: 'Sem veículo', count: drivers.filter(d => !d.assigned_vehicle_id).length },
    { key: 'problem', label: 'Problemas', count: problemDrivers.length },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Motoristas</h1>
          <p className="text-sm text-gray-500">{drivers.length} motoristas registados</p>
        </div>
        <Button onClick={() => { setEditingDriver(null); setShowForm(true); }} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="w-4 h-4" /> Adicionar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{activeDrivers.length}</p>
            <p className="text-xs text-gray-500">Ativos</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <Ban className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{inactiveDrivers.length}</p>
            <p className="text-xs text-gray-500">Inativos</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{unpaidDeposit.length}</p>
            <p className="text-xs text-gray-500">Caução por pagar</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{problemDrivers.length}</p>
            <p className="text-xs text-gray-500">Com problemas</p>
          </div>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setQuickFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              quickFilter === f.key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {f.label} <span className="ml-1 opacity-70">({f.count})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Pesquisar motorista..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nenhum motorista encontrado</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Motorista</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Contrato</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Veículo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Caução</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Global</th>
                <th className="w-10 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(driver => (
                <tr
                  key={driver.id}
                  className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                  onClick={() => { setEditingDriver(driver); setShowForm(true); }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                        {driver.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{driver.full_name}</p>
                        <p className="text-xs text-gray-400">{driver.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 hidden md:table-cell">
                    {driver.contract_type ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{driver.contract_type.replace('_', ' ')}</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {driver.assigned_vehicle_plate ? (
                      <span className="text-sm font-mono text-gray-700">{driver.assigned_vehicle_plate}</span>
                    ) : (
                      <span className="text-xs text-red-400 flex items-center gap-1"><Car className="w-3 h-3" />Sem veículo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {driver.vehicle_deposit_paid ? (
                      <Badge className="bg-green-100 text-green-700 border-0 text-xs">Sim</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-600 border-0 text-xs">Não</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[driver.status] || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[driver.status] || driver.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <GlobalStatusBadge driver={driver} />
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => { setEditingDriver(driver); setShowForm(true); }} className="gap-2">
                          <UserCircle className="w-4 h-4" /> Ver perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditingDriver(driver); setShowForm(true); }} className="gap-2">
                          <Car className="w-4 h-4" /> Atribuir veículo
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => updateMutation.mutate({ id: driver.id, data: { status: 'suspended' } })}
                          className="gap-2 text-red-600 focus:text-red-600"
                        >
                          <Ban className="w-4 h-4" /> Suspender
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingDriver(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDriver ? 'Editar motorista' : 'Novo motorista'}</DialogTitle>
          </DialogHeader>
          <DriverForm
            key={editingDriver?.id || 'new'}
            driver={editingDriver}
            vehicles={vehicles}
            fleetManagers={fleetManagers}
            onSubmit={handleSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}