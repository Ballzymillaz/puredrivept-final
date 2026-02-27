import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import FleetVehiclesFilter from '../components/fleets/FleetVehiclesFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Car, Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';

export default function FleetVehicles({ currentUser }) {
  const [filters, setFilters] = useState({ search: '', status: 'all', fuelType: 'all' });
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [form, setForm] = useState({
    brand: '',
    model: '',
    license_plate: '',
    status: 'available',
    fuel_type: 'diesel',
    assigned_driver_id: '',
    assigned_driver_name: '',
  });

  const qc = useQueryClient();
  const isAdmin = currentUser?.roles?.includes('admin') || currentUser?.roles?.includes('fleet_manager');

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-created_date'),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editingVehicle
        ? base44.entities.Vehicle.update(editingVehicle.id, data)
        : base44.entities.Vehicle.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Vehicle.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleet-vehicles'] }),
  });

  const openCreate = () => {
    setEditingVehicle(null);
    setForm({
      brand: '',
      model: '',
      license_plate: '',
      status: 'available',
      fuel_type: 'diesel',
      assigned_driver_id: '',
      assigned_driver_name: '',
    });
    setShowForm(true);
  };

  const openEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setForm({
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      license_plate: vehicle.license_plate || '',
      status: vehicle.status || 'available',
      fuel_type: vehicle.fuel_type || 'diesel',
      assigned_driver_id: vehicle.assigned_driver_id || '',
      assigned_driver_name: vehicle.assigned_driver_name || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingVehicle(null);
  };

  const handleSave = () => {
    if (!form.brand?.trim() || !form.model?.trim() || !form.license_plate?.trim()) return;
    saveMutation.mutate(form);
  };

  const handleDriverChange = (driverId) => {
    const driver = drivers.find((d) => d.id === driverId);
    setForm((p) => ({
      ...p,
      assigned_driver_id: driverId,
      assigned_driver_name: driver?.full_name || '',
    }));
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const searchLower = filters.search.toLowerCase();
      const matchSearch =
        !filters.search ||
        v.license_plate?.toLowerCase().includes(searchLower) ||
        v.brand?.toLowerCase().includes(searchLower) ||
        v.model?.toLowerCase().includes(searchLower);

      const matchStatus = filters.status === 'all' || v.status === filters.status;
      const matchFuel = filters.fuelType === 'all' || v.fuel_type === filters.fuelType;

      return matchSearch && matchStatus && matchFuel;
    });
  }, [vehicles, filters]);

  const statusConfig = {
    available: { label: 'Disponível', color: 'bg-green-100 text-green-700' },
    assigned: { label: 'Atribuído', color: 'bg-blue-100 text-blue-700' },
    maintenance: { label: 'Manutenção', color: 'bg-yellow-100 text-yellow-700' },
    inactive: { label: 'Inativo', color: 'bg-gray-100 text-gray-600' },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Veículos de Frota"
        subtitle={`${filteredVehicles.length} de ${vehicles.length} veículos`}
        actionLabel={isAdmin ? 'Novo Veículo' : null}
        onAction={isAdmin ? openCreate : null}
      />

      <FleetVehiclesFilter onFilterChange={setFilters} vehicles={vehicles} />

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Car className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum veículo encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle) => (
            <Card key={vehicle.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {vehicle.brand} {vehicle.model}
                    </CardTitle>
                    <p className="text-sm font-mono text-gray-500 mt-1">{vehicle.license_plate}</p>
                  </div>
                  <Badge className={`whitespace-nowrap ${statusConfig[vehicle.status]?.color || 'bg-gray-100'}`}>
                    {statusConfig[vehicle.status]?.label || vehicle.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5 text-xs text-gray-600">
                  <p>
                    <span className="text-gray-400">Combustível:</span> {vehicle.fuel_type || '—'}
                  </p>
                  {vehicle.assigned_driver_name && (
                    <p className="flex items-center gap-1">
                      <span className="text-gray-400">Motorista:</span> {vehicle.assigned_driver_name}
                    </p>
                  )}
                  {vehicle.insurance_expiry && (
                    <p className="flex items-center gap-1">
                      <span className="text-gray-400">Seguro:</span>
                      <span
                        className={
                          new Date(vehicle.insurance_expiry) < new Date()
                            ? 'text-red-600 font-medium flex items-center gap-1'
                            : 'text-amber-600'
                        }
                      >
                        {new Date(vehicle.insurance_expiry) < new Date() && <AlertCircle className="w-3 h-3" />}
                        {new Date(vehicle.insurance_expiry).toLocaleDateString('pt-PT')}
                      </span>
                    </p>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(vehicle)} className="flex-1 gap-1">
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('Eliminar veículo?')) deleteMutation.mutate(vehicle.id);
                      }}
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Marca *</Label>
              <Input value={form.brand} onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Modelo *</Label>
              <Input value={form.model} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Matrícula *</Label>
              <Input
                value={form.license_plate}
                onChange={(e) => setForm((p) => ({ ...p, license_plate: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="assigned">Atribuído</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Combustível</Label>
                <Select value={form.fuel_type} onValueChange={(v) => setForm((p) => ({ ...p, fuel_type: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gasoline">Gasolina</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="hybrid">Híbrido</SelectItem>
                    <SelectItem value="electric">Elétrico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Motorista</Label>
              <Select value={form.assigned_driver_id} onValueChange={handleDriverChange}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Nenhum</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.full_name}
                    </SelectItem>
                  ))}
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