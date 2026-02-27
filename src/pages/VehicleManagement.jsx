import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Car, AlertCircle, CheckCircle2, Wrench, Clock } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  available: 'bg-green-100 text-green-700',
  assigned: 'bg-blue-100 text-blue-700',
  alugado: 'bg-purple-100 text-purple-700',
  maintenance: 'bg-orange-100 text-orange-700',
  inactive: 'bg-gray-100 text-gray-700',
};

const STATUS_ICONS = {
  available: CheckCircle2,
  assigned: Car,
  alugado: Clock,
  maintenance: Wrench,
  inactive: AlertCircle,
};

const STATUS_LABELS = {
  available: 'Disponível',
  assigned: 'Atribuído',
  alugado: 'Alugado',
  maintenance: 'Manutenção',
  inactive: 'Inativo',
};

export default function VehicleManagement({ currentUser }) {
  const qc = useQueryClient();
  const isAdmin = currentUser?.role?.includes('admin');

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: 'all', fleet_manager: 'all', brand: 'all' });
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [editForm, setEditForm] = useState({});

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-created_date'),
    enabled: isAdmin,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-for-assign'],
    queryFn: () => base44.entities.Driver.list(),
    enabled: isAdmin,
  });

  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleet-managers'],
    queryFn: () => base44.entities.FleetManager.list(),
    enabled: isAdmin,
  });

  const updateVehicleMutation = useMutation({
    mutationFn: (data) => base44.entities.Vehicle.update(selectedVehicle.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      setSelectedVehicle(null);
      setEditForm({});
    },
  });

  const handleAssignDriver = async () => {
    if (!editForm.assigned_driver_id) return;
    const driver = drivers.find(d => d.id === editForm.assigned_driver_id);
    await updateVehicleMutation.mutate({
      assigned_driver_id: editForm.assigned_driver_id,
      assigned_driver_name: driver?.full_name,
      status: 'assigned',
    });
  };

  const handleUnassignDriver = async () => {
    await updateVehicleMutation.mutate({
      assigned_driver_id: null,
      assigned_driver_name: null,
      status: 'available',
    });
  };

  const handleUpdateMaintenance = async () => {
    await updateVehicleMutation.mutate({
      insurance_expiry: editForm.insurance_expiry,
      inspection_expiry: editForm.inspection_expiry,
    });
  };

  const filtered = vehicles.filter(v => {
    const searchMatch =
      !search ||
      v.license_plate?.toLowerCase().includes(search.toLowerCase()) ||
      v.brand?.toLowerCase().includes(search.toLowerCase()) ||
      v.model?.toLowerCase().includes(search.toLowerCase());

    const statusMatch = filters.status === 'all' || v.status === filters.status;
    const brandMatch = filters.brand === 'all' || v.brand === filters.brand;
    const fleetMatch = filters.fleet_manager === 'all' || v.fleet_manager_id === filters.fleet_manager;

    return searchMatch && statusMatch && brandMatch && fleetMatch;
  });

  const uniqueBrands = [...new Set(vehicles.map(v => v.brand))].sort();

  if (!isAdmin) {
    return <div className="text-center py-12 text-gray-500">Acesso restrito a administradores</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Gestão de Veículos" subtitle={`${filtered.length} de ${vehicles.length} veículos`} />

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Pesquisar por matrícula, marca ou modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Marca</Label>
            <Select value={filters.brand} onValueChange={(v) => setFilters(f => ({ ...f, brand: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as marcas</SelectItem>
                {uniqueBrands.map((brand) => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Gestor de Frota</Label>
            <Select value={filters.fleet_manager} onValueChange={(v) => setFilters(f => ({ ...f, fleet_manager: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os gestores</SelectItem>
                {fleetManagers.map((fm) => (
                  <SelectItem key={fm.id} value={fm.id}>{fm.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Vehicles List */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-12">A carregar...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Nenhum veículo encontrado</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((vehicle) => {
            const StatusIcon = STATUS_ICONS[vehicle.status];
            return (
              <div
                key={vehicle.id}
                onClick={() => {
                  setSelectedVehicle(vehicle);
                  setEditForm({
                    assigned_driver_id: vehicle.assigned_driver_id || '',
                    insurance_expiry: vehicle.insurance_expiry || '',
                    inspection_expiry: vehicle.inspection_expiry || '',
                  });
                }}
                className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Car className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {vehicle.brand} {vehicle.model} — {vehicle.license_plate}
                    </p>
                    <p className="text-xs text-gray-500">
                      {vehicle.assigned_driver_name ? `Motorista: ${vehicle.assigned_driver_name}` : 'Sem motorista atribuído'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`${STATUS_COLORS[vehicle.status]} border-0`}>
                    {STATUS_LABELS[vehicle.status]}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!selectedVehicle} onOpenChange={(o) => { if (!o) setSelectedVehicle(null); }}>
        <DialogContent className="max-w-md">
          {selectedVehicle && (
            <>
              <DialogHeader>
                <DialogTitle>Editar Veículo</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedVehicle.brand} {selectedVehicle.model}
                  </p>
                  <p className="text-xs text-gray-500">{selectedVehicle.license_plate}</p>
                </div>

                {/* Assign Driver */}
                <div className="space-y-3 border-t pt-4">
                  <h3 className="font-semibold text-sm text-gray-900">Atribuição de Motorista</h3>
                  {selectedVehicle.assigned_driver_name ? (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm text-gray-900">{selectedVehicle.assigned_driver_name}</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleUnassignDriver}
                      >
                        Desatribuir
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Select value={editForm.assigned_driver_id || ''} onValueChange={(v) => setEditForm(f => ({ ...f, assigned_driver_id: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar motorista..." />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.filter(d => !d.assigned_vehicle_id).map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.full_name} ({d.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={handleAssignDriver}
                        disabled={!editForm.assigned_driver_id}
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                      >
                        Atribuir
                      </Button>
                    </div>
                  )}
                </div>

                {/* Maintenance Dates */}
                <div className="space-y-3 border-t pt-4">
                  <h3 className="font-semibold text-sm text-gray-900">Datas de Manutenção</h3>

                  <div className="space-y-1">
                    <Label className="text-xs">Data de Inspeção</Label>
                    <Input
                      type="date"
                      value={editForm.inspection_expiry || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, inspection_expiry: e.target.value }))}
                    />
                    {selectedVehicle.inspection_expiry && (
                      <p className="text-xs text-gray-500">
                        Válida até: {format(new Date(selectedVehicle.inspection_expiry), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Data de Seguro</Label>
                    <Input
                      type="date"
                      value={editForm.insurance_expiry || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, insurance_expiry: e.target.value }))}
                    />
                    {selectedVehicle.insurance_expiry && (
                      <p className="text-xs text-gray-500">
                        Válido até: {format(new Date(selectedVehicle.insurance_expiry), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    onClick={handleUpdateMaintenance}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    Guardar Datas
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}