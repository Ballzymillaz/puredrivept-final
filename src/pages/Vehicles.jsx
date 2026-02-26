import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import VehicleForm from '../components/vehicles/VehicleForm';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Vehicles() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-created_date'),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Vehicle.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); setShowForm(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Vehicle.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); setShowForm(false); setEditing(null); },
  });

  const handleSubmit = (data) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const filtered = vehicles.filter(v =>
    !search || v.brand?.toLowerCase().includes(search.toLowerCase()) ||
    v.model?.toLowerCase().includes(search.toLowerCase()) ||
    v.license_plate?.toLowerCase().includes(search.toLowerCase())
  );

  const FUEL_LABELS = { gasoline: 'Gasolina', diesel: 'Diesel', hybrid: 'Híbrido', electric: 'Elétrico' };

  const columns = [
    {
      header: 'Veículo',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{r.brand} {r.model}</p>
          <p className="text-xs text-gray-500">{r.year} · {FUEL_LABELS[r.fuel_type] || r.fuel_type}</p>
        </div>
      ),
    },
    { header: 'Matrícula', render: (r) => <span className="font-mono text-sm font-medium">{r.license_plate}</span> },
    { header: 'Motorista', render: (r) => <span className="text-sm">{r.assigned_driver_name || '—'}</span> },
    { header: 'Aluguer/sem', render: (r) => r.weekly_rental_price ? `€${r.weekly_rental_price}` : '—' },
    { header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Veículos" subtitle={`${vehicles.length} veículos`} actionLabel="Adicionar" onAction={() => { setEditing(null); setShowForm(true); }} />
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={(r) => { setEditing(r); setShowForm(true); }} />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar veículo' : 'Novo veículo'}</DialogTitle></DialogHeader>
          <VehicleForm vehicle={editing} drivers={drivers} onSubmit={handleSubmit} isLoading={createMutation.isPending || updateMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}