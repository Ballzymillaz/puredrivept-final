import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import FleetContractsFilter from '../components/fleets/FleetContractsFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function FleetContracts({ currentUser }) {
  const [filters, setFilters] = useState({ search: '', status: 'all', contractType: 'all' });
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [form, setForm] = useState({
    driver_id: '',
    driver_name: '',
    vehicle_id: '',
    vehicle_info: '',
    contract_type: 'slot_standard',
    start_date: '',
    end_date: '',
    status: 'active',
    notes: '',
  });

  const qc = useQueryClient();
  const isAdmin = currentUser?.roles?.includes('admin') || currentUser?.roles?.includes('fleet_manager');

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['fleet-contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date'),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-for-contract'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-for-contract'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editingContract
        ? base44.entities.Contract.update(editingContract.id, data)
        : base44.entities.Contract.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fleet-contracts'] });
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contract.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleet-contracts'] }),
  });

  const openCreate = () => {
    setEditingContract(null);
    setForm({
      driver_id: '',
      driver_name: '',
      vehicle_id: '',
      vehicle_info: '',
      contract_type: 'slot_standard',
      start_date: '',
      end_date: '',
      status: 'active',
      notes: '',
    });
    setShowForm(true);
  };

  const openEdit = (contract) => {
    setEditingContract(contract);
    setForm({
      driver_id: contract.driver_id || '',
      driver_name: contract.driver_name || '',
      vehicle_id: contract.vehicle_id || '',
      vehicle_info: contract.vehicle_info || '',
      contract_type: contract.contract_type || 'slot_standard',
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
      status: contract.status || 'active',
      notes: contract.notes || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingContract(null);
  };

  const handleDriverChange = (driverId) => {
    const driver = drivers.find((d) => d.id === driverId);
    setForm((p) => ({
      ...p,
      driver_id: driverId,
      driver_name: driver?.full_name || '',
    }));
  };

  const handleVehicleChange = (vehicleId) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const vehicleInfo = vehicle ? `${vehicle.brand} ${vehicle.model} - ${vehicle.license_plate}` : '';
    setForm((p) => ({
      ...p,
      vehicle_id: vehicleId,
      vehicle_info: vehicleInfo,
    }));
  };

  const handleSave = () => {
    if (!form.driver_id || !form.vehicle_id || !form.start_date) return;
    saveMutation.mutate(form);
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      const searchLower = filters.search.toLowerCase();
      const matchSearch =
        !filters.search ||
        c.driver_name?.toLowerCase().includes(searchLower) ||
        c.vehicle_info?.toLowerCase().includes(searchLower);

      const matchStatus = filters.status === 'all' || c.status === filters.status;
      const matchContract = filters.contractType === 'all' || c.contract_type === filters.contractType;

      return matchSearch && matchStatus && matchContract;
    });
  }, [contracts, filters]);

  const statusConfig = {
    active: { label: 'Ativo', color: 'bg-green-100 text-green-700' },
    expired: { label: 'Expirado', color: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-600' },
  };

  const contractTypeLabel = {
    slot_standard: 'Slot Standard',
    slot_premium: 'Slot Premium',
    slot_black: 'Slot Black',
    location: 'Location',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos de Frota"
        subtitle={`${filteredContracts.length} de ${contracts.length} contratos`}
        actionLabel={isAdmin ? 'Novo Contrato' : null}
        onAction={isAdmin ? openCreate : null}
      />

      <FleetContractsFilter onFilterChange={setFilters} contracts={contracts} />

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : filteredContracts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum contrato encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredContracts.map((contract) => {
            const isExpiring = contract.end_date && new Date(contract.end_date) < new Date();
            return (
              <Card key={contract.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{contract.driver_name}</CardTitle>
                      <p className="text-xs text-gray-500 mt-1">{contract.vehicle_info}</p>
                    </div>
                    <Badge className={statusConfig[contract.status]?.color || 'bg-gray-100'}>
                      {statusConfig[contract.status]?.label || contract.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5 text-sm text-gray-600">
                    <p>
                      <span className="text-gray-400">Tipo:</span> {contractTypeLabel[contract.contract_type]}
                    </p>
                    <p>
                      <span className="text-gray-400">Início:</span>{' '}
                      {format(new Date(contract.start_date), 'dd/MM/yyyy')}
                    </p>
                    {contract.end_date && (
                      <p className={isExpiring ? 'flex items-center gap-1 text-red-600 font-medium' : ''}>
                        {isExpiring && <AlertCircle className="w-3 h-3" />}
                        <span className="text-gray-400">Fim:</span>{' '}
                        {format(new Date(contract.end_date), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(contract)} className="flex-1 gap-1">
                        <Edit2 className="w-3.5 h-3.5" /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('Eliminar contrato?')) deleteMutation.mutate(contract.id);
                        }}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContract ? 'Editar Contrato' : 'Novo Contrato'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Motorista *</Label>
              <Select value={form.driver_id} onValueChange={handleDriverChange}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Veículo *</Label>
              <Select value={form.vehicle_id} onValueChange={handleVehicleChange}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.brand} {v.model} - {v.license_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Tipo de Contrato *</Label>
              <Select value={form.contract_type} onValueChange={(v) => setForm((p) => ({ ...p, contract_type: v }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slot_standard">Slot Standard</SelectItem>
                  <SelectItem value="slot_premium">Slot Premium</SelectItem>
                  <SelectItem value="slot_black">Slot Black</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Data de Início *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Data de Fim</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="expired">Expirado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeForm}>
                Cancelar
              </Button>
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