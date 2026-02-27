import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import DriverForm from '../components/drivers/DriverForm';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users, Zap } from 'lucide-react';
import AutoAssignDialog from '../components/vehicles/AutoAssignDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';

export default function Drivers() {
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAutoAssign, setShowAutoAssign] = useState(false);
  const [autoAssignDriver, setAutoAssignDriver] = useState(null);
  const queryClient = useQueryClient();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list('-created_date'),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: commercials = [] } = useQuery({
    queryKey: ['commercials'],
    queryFn: () => base44.entities.Commercial.list(),
  });

  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleetManagers'],
    queryFn: () => base44.entities.FleetManager.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Driver.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Driver.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setShowForm(false);
      setEditingDriver(null);
    },
  });

  const handleSubmit = (data) => {
    if (editingDriver) {
      updateMutation.mutate({ id: editingDriver.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filtered = drivers.filter(d => {
    const matchSearch = !search || d.full_name?.toLowerCase().includes(search.toLowerCase()) || d.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const CONTRACT_LABELS = {
    slot_standard: 'Slot Standard',
    slot_premium: 'Slot Premium',
    slot_black: 'Slot Black',
    location: 'Location',
  };

  const columns = [
    {
      header: 'Motorista',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700">
            {row.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{row.full_name}</p>
            <p className="text-xs text-gray-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    { header: 'Telefone', accessor: 'phone' },
    {
      header: 'Contrato',
      render: (row) => (
        <span className="text-sm">{CONTRACT_LABELS[row.contract_type] || '—'}</span>
      ),
    },
    {
      header: 'Veículo',
      render: (row) => <span className="text-sm">{row.assigned_vehicle_plate || '—'}</span>,
    },
    {
      header: 'Caução paga',
      render: (row) => (
        <span className={`text-sm font-medium ${row.vehicle_deposit_paid ? 'text-emerald-600' : 'text-red-500'}`}>
          {row.vehicle_deposit_paid ? 'Sim' : 'Não'}
        </span>
      ),
    },
    { header: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
    {
      header: '',
      render: (row) => !row.assigned_vehicle_id ? (
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-yellow-600 hover:bg-yellow-50"
          onClick={e => { e.stopPropagation(); setAutoAssignDriver(row); setShowAutoAssign(true); }}>
          <Zap className="w-3 h-3" /> Atribuir
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <AutoAssignDialog
        open={showAutoAssign}
        onClose={() => { setShowAutoAssign(false); setAutoAssignDriver(null); }}
        drivers={drivers}
        vehicles={vehicles}
        preselectedDriverId={autoAssignDriver?.id}
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['drivers'] }); queryClient.invalidateQueries({ queryKey: ['vehicles'] }); setShowAutoAssign(false); setAutoAssignDriver(null); }}
      />
      <PageHeader
        title="Motoristas"
        subtitle={`${drivers.length} motoristas registados`}
        actionLabel="Adicionar"
        onAction={() => { setEditingDriver(null); setShowForm(true); }}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Pesquisar motorista..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
            <SelectItem value="evaluation">Avaliação</SelectItem>
            <SelectItem value="suspended">Suspenso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        onRowClick={(row) => { setEditingDriver(row); setShowForm(true); }}
        emptyMessage="Nenhum motorista encontrado"
      />

      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) setEditingDriver(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDriver ? 'Editar motorista' : 'Novo motorista'}</DialogTitle>
          </DialogHeader>
          <DriverForm
            key={editingDriver?.id || 'new'}
            driver={editingDriver}
            vehicles={vehicles}
            commercials={commercials}
            fleetManagers={fleetManagers}
            onSubmit={handleSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}