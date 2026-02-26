import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search } from 'lucide-react';

export default function Contracts() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date'),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Contract.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const handleSubmit = (data) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const filtered = contracts.filter(c =>
    !search || c.driver_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.vehicle_info?.toLowerCase().includes(search.toLowerCase())
  );

  const CONTRACT_LABELS = {
    slot_standard: 'Slot Standard (35€)',
    slot_premium: 'Slot Premium (45€)',
    slot_black: 'Slot Black (99€)',
    location: 'Aluguer',
  };

  const columns = [
    {
      header: 'Motorista',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{r.driver_name}</p>
          <p className="text-xs text-gray-500">{r.vehicle_info || '—'}</p>
        </div>
      ),
    },
    {
      header: 'Tipo de contrato',
      render: (r) => <span className="text-sm">{CONTRACT_LABELS[r.contract_type]}</span>,
    },
    {
      header: 'Valor semanal',
      render: (r) => <span className="text-sm font-medium">€{r.slot_fee || r.weekly_rental_price || 0}</span>,
    },
    {
      header: 'Data início',
      render: (r) => <span className="text-sm">{r.start_date ? new Date(r.start_date).toLocaleDateString('pt-PT') : '—'}</span>,
    },
    {
      header: 'Estado',
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contratos"
        subtitle={`${contracts.length} contratos`}
        actionLabel="Adicionar"
        onAction={() => { setEditing(null); setShowForm(true); }}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        onRowClick={(r) => { setEditing(r); setShowForm(true); }}
        emptyMessage="Nenhum contrato encontrado"
      />

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar contrato' : 'Novo contrato'}</DialogTitle>
          </DialogHeader>
          <ContractForm
            key={editing?.id || 'new'}
            contract={editing}
            drivers={drivers}
            vehicles={vehicles}
            onSubmit={handleSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContractForm({ contract, drivers, vehicles, onSubmit, isLoading }) {
  const [form, setForm] = useState({
    driver_id: contract?.driver_id || '',
    vehicle_id: contract?.vehicle_id || '',
    contract_type: contract?.contract_type || '',
    start_date: contract?.start_date || '',
    end_date: contract?.end_date || '',
    status: contract?.status || 'active',
    notes: contract?.notes || '',
  });

  const CONTRACT_CONFIG = {
    slot_standard: { slot_fee: 35 },
    slot_premium: { slot_fee: 45 },
    slot_black: { slot_fee: 99 },
    location: { weekly_rental_price: 0 },
  };

  const availableVehicles = vehicles.filter(v => v.status === 'available' || v.id === form.vehicle_id);

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };

    const driver = drivers.find(d => d.id === data.driver_id);
    if (driver) data.driver_name = driver.full_name;

    const vehicle = vehicles.find(v => v.id === data.vehicle_id);
    if (vehicle) data.vehicle_info = `${vehicle.brand} ${vehicle.model} - ${vehicle.license_plate}`;

    if (data.contract_type && CONTRACT_CONFIG[data.contract_type]) {
      if (data.contract_type === 'location') {
        data.weekly_rental_price = vehicle?.weekly_rental_price || 0;
      } else {
        data.slot_fee = CONTRACT_CONFIG[data.contract_type].slot_fee;
      }
    }

    if (!data.end_date) delete data.end_date;

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Motorista *</Label>
          <Select value={form.driver_id} onValueChange={(v) => handleChange('driver_id', v)}>
            <SelectTrigger><SelectValue placeholder="Selecionar motorista..." /></SelectTrigger>
            <SelectContent>
              {drivers.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.full_name} ({d.email})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Veículo (opcional)</Label>
          <Select value={form.vehicle_id} onValueChange={(v) => handleChange('vehicle_id', v)}>
            <SelectTrigger><SelectValue placeholder="Sem veículo ou selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Nenhum</SelectItem>
              {availableVehicles.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} - {v.license_plate}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Tipo de contrato *</Label>
          <Select value={form.contract_type} onValueChange={(v) => handleChange('contract_type', v)}>
            <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="slot_standard">Slot Standard (35€/sem)</SelectItem>
              <SelectItem value="slot_premium">Slot Premium (45€/sem)</SelectItem>
              <SelectItem value="slot_black">Slot Black (99€/sem)</SelectItem>
              <SelectItem value="location">Aluguer de veículo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Data início *</Label>
          <Input type="date" value={form.start_date} onChange={(e) => handleChange('start_date', e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Data fim (opcional)</Label>
          <Input type="date" value={form.end_date} onChange={(e) => handleChange('end_date', e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Estado</Label>
          <Select value={form.status} onValueChange={(v) => handleChange('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="expired">Expirado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Observações</Label>
        <Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={3} />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'A guardar...' : contract ? 'Atualizar' : 'Criar contrato'}
      </Button>
    </form>
  );
}