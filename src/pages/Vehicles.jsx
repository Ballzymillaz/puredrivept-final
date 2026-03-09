import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import VehicleForm from '../components/vehicles/VehicleForm';
import { Input } from '@/components/ui/input';
import { Search, ExternalLink, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createPageUrl } from '@/utils';
import { differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';

export default function Vehicles({ currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const isAdmin = currentUser?.role === 'admin' || currentUser?._realRole === 'admin';
  const isFleetManager = currentUser?.role === 'fleet_manager';
  const isSimulation = !!currentUser?._isSimulation;

  const { data: allFleets = [] } = useQuery({
    queryKey: ['fleets-raw'],
    queryFn: () => base44.entities.Fleet.list(),
    enabled: isFleetManager,
  });

  const { data: allFleetManagers = [] } = useQuery({
    queryKey: ['fleet-managers-list'],
    queryFn: () => base44.entities.FleetManager.list(),
    enabled: isFleetManager,
  });

  const { data: allVehiclesRaw = [], isLoading } = useQuery({
    queryKey: ['vehicles-raw'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const vehicles = React.useMemo(() => {
    if (!isFleetManager) return allVehiclesRaw;
    const myFM = allFleetManagers.find(fm =>
      fm.user_id === currentUser?.id ||
      fm.email === currentUser?.email
    );
    const myFMId = myFM?.id;
    const myFleets = allFleets.filter(f =>
      f.fleet_manager_id === myFMId ||
      f.fleet_manager_id === currentUser?.id ||
      f.fleet_manager_id === currentUser?.email
    );
    const fleetVehicleIds = new Set(myFleets.flatMap(f => f.vehicle_ids || []));
    return allVehiclesRaw.filter(v =>
      fleetVehicleIds.has(v.id) ||
      (myFMId && v.fleet_manager_id === myFMId) ||
      v.fleet_manager_id === currentUser?.id ||
      v.fleet_manager_id === currentUser?.email
    );
  }, [isFleetManager, allVehiclesRaw, allFleets, allFleetManagers, currentUser]);

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

  const getTvdeExpiry = (firstRegDate) => {
    if (!firstRegDate) return null;
    const d = new Date(firstRegDate);
    d.setFullYear(d.getFullYear() + 7);
    return d;
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-PT') : '—';

  const { data: maintenances = [] } = useQuery({
    queryKey: ['maintenance-all'],
    queryFn: () => base44.entities.MaintenanceRecord.list(),
  });

  const today = new Date();

  // Check which vehicles have upcoming maintenance
  const vehicleAlerts = (vehicleId) => {
    return maintenances.some(m => m.vehicle_id === vehicleId && m.next_service_date && differenceInDays(new Date(m.next_service_date), today) <= 30 && differenceInDays(new Date(m.next_service_date), today) >= 0);
  };

  const columns = [
    {
      header: 'Veículo',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{r.brand} {r.model}</p>
          <p className="text-xs text-gray-500">{r.first_registration_date ? formatDate(r.first_registration_date) : '—'} · {FUEL_LABELS[r.fuel_type] || r.fuel_type}</p>
        </div>
      ),
    },
    { header: 'Matrícula', render: (r) => <span className="font-mono text-sm font-medium">{r.license_plate}</span> },
    { header: 'Motorista', render: (r) => <span className="text-sm">{r.assigned_driver_name || '—'}</span> },
    { header: 'Aluguer/sem', render: (r) => r.weekly_rental_price ? `€${r.weekly_rental_price}` : '—' },
    {
      header: 'Fim TVDE',
      render: (r) => {
        const expiry = getTvdeExpiry(r.first_registration_date);
        if (!expiry) return <span className="text-gray-400 text-xs">—</span>;
            const now = new Date();
        const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
        const yearsLeft = (expiry - now) / msPerYear;
        let colorClass = 'text-gray-700';
        let warning = '';
        if (yearsLeft < 0) { colorClass = 'text-red-600'; warning = ' ⚠️'; }
        else if (yearsLeft < 1) { colorClass = 'text-red-600'; warning = ' ⚠️'; }
        else if (yearsLeft < 2) { colorClass = 'text-orange-500'; }
        else if (yearsLeft < 3) { colorClass = 'text-yellow-600'; }
        return (
          <span className={`text-xs font-medium ${colorClass}`}>
            {expiry.toLocaleDateString('pt-PT')}{warning}
          </span>
        );
      },
    },
    { header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
    { header: '', render: (r) => (
      <div className="flex items-center gap-2">
        {vehicleAlerts(r.id) && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" title="Manutenção próxima" />}
        <Link to={createPageUrl(`VehicleDetail?id=${r.id}`)} onClick={e => e.stopPropagation()} className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">
          Detalhes <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Veículos"
        subtitle={`${filtered.length} veículos`}
        actionLabel={isAdmin && !isSimulation ? "Adicionar" : undefined}
        onAction={isAdmin && !isSimulation ? () => { setEditing(null); setShowForm(true); } : undefined}
      />
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={(r) => { if (isAdmin || isFleetManager) { setEditing(r); setShowForm(true); } }} />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar veículo' : 'Novo veículo'}</DialogTitle></DialogHeader>
          <VehicleForm vehicle={editing} drivers={drivers} onSubmit={handleSubmit} isLoading={createMutation.isPending || updateMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}