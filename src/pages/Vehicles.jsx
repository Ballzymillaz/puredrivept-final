import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Car, Plus, Search, Edit2, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Disponível', color: 'bg-green-100 text-green-700' },
  { value: 'assigned', label: 'Atribuído', color: 'bg-blue-100 text-blue-700' },
  { value: 'alugado', label: 'Alugado', color: 'bg-purple-100 text-purple-700' },
  { value: 'maintenance', label: 'Manutenção', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'inactive', label: 'Inativo', color: 'bg-gray-100 text-gray-700' },
];

const FUEL_OPTIONS = ['gasoline', 'diesel', 'hybrid', 'electric'];

export default function Vehicles({ currentUser }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [formData, setFormData] = useState({
    brand: '', model: '', license_plate: '', color: '', vin: '',
    fuel_type: 'gasoline', status: 'available',
    insurance_expiry: '', inspection_expiry: '',
    weekly_rental_price: '', assigned_driver_id: '', fleet_manager_id: ''
  });

  const isAdmin = currentUser?.role?.includes('admin');
  const isFleetManager = currentUser?.role?.includes('fleet_manager');

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-created_date'),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleetmanagers'],
    queryFn: () => base44.entities.FleetManager.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Vehicle.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      handleCloseForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Vehicle.update(selectedVehicle.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      handleCloseForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Vehicle.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      setSelectedVehicle(null);
    },
  });

  const qc = useQueryClient();

  const filteredVehicles = vehicles.filter(v => {
    const searchLower = search.toLowerCase();
    const matchSearch = !search || 
      v.brand?.toLowerCase().includes(searchLower) ||
      v.model?.toLowerCase().includes(searchLower) ||
      v.license_plate?.toLowerCase().includes(searchLower);
    
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleOpenForm = (vehicle = null) => {
    if (vehicle) {
      setSelectedVehicle(vehicle);
      setFormData(vehicle);
    } else {
      setSelectedVehicle(null);
      setFormData({
        brand: '', model: '', license_plate: '', color: '', vin: '',
        fuel_type: 'gasoline', status: 'available',
        insurance_expiry: '', inspection_expiry: '',
        weekly_rental_price: '', assigned_driver_id: '', fleet_manager_id: ''
      });
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedVehicle(null);
  };

  const handleSave = async () => {
    const data = {
      brand: formData.brand,
      model: formData.model,
      license_plate: formData.license_plate,
      color: formData.color || undefined,
      vin: formData.vin || undefined,
      fuel_type: formData.fuel_type,
      status: formData.status,
      insurance_expiry: formData.insurance_expiry || undefined,
      inspection_expiry: formData.inspection_expiry || undefined,
      weekly_rental_price: formData.weekly_rental_price ? parseFloat(formData.weekly_rental_price) : undefined,
      assigned_driver_id: formData.assigned_driver_id || undefined,
      assigned_driver_name: formData.assigned_driver_id 
        ? drivers.find(d => d.id === formData.assigned_driver_id)?.full_name 
        : undefined,
      fleet_manager_id: formData.fleet_manager_id || undefined,
      fleet_manager_name: formData.fleet_manager_id 
        ? fleetManagers.find(f => f.id === formData.fleet_manager_id)?.full_name 
        : undefined,
    };

    if (selectedVehicle) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const getExpiryStatus = (date) => {
    if (!date) return null;
    const daysUntilExpiry = differenceInDays(new Date(date), new Date());
    if (daysUntilExpiry <= 0) return { label: 'Expirado', color: 'text-red-600' };
    if (daysUntilExpiry <= 30) return { label: `${daysUntilExpiry} dias`, color: 'text-yellow-600' };
    return null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Veículos"
        subtitle={`${vehicles.length} veículos`}
        actionLabel="Adicionar Veículo"
        onAction={() => handleOpenForm()}
        actionIcon={Plus}
      />

      <div className="bg-white rounded-lg border shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Pesquisar por marca, modelo, matrícula..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {STATUS_OPTIONS.map(status => (
            <button
              key={status.value}
              onClick={() => setStatusFilter(status.value)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                statusFilter === status.value
                  ? status.color
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Car className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum veículo encontrado</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredVehicles.map(vehicle => {
            const statusConfig = STATUS_OPTIONS.find(s => s.value === vehicle.status);
            const insuranceStatus = getExpiryStatus(vehicle.insurance_expiry);
            const inspectionStatus = getExpiryStatus(vehicle.inspection_expiry);

            return (
              <div
                key={vehicle.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-gray-900">
                        {vehicle.brand} {vehicle.model}
                      </h3>
                      <Badge className={`text-xs border-0 ${statusConfig?.color || 'bg-gray-100 text-gray-700'}`}>
                        {statusConfig?.label || vehicle.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{vehicle.license_plate}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {vehicle.assigned_driver_name && (
                        <div>
                          <p className="text-gray-400">Motorista</p>
                          <p className="text-gray-700 font-medium">{vehicle.assigned_driver_name}</p>
                        </div>
                      )}
                      {vehicle.fuel_type && (
                        <div>
                          <p className="text-gray-400">Combustível</p>
                          <p className="text-gray-700 font-medium capitalize">{vehicle.fuel_type}</p>
                        </div>
                      )}
                      {insuranceStatus && (
                        <div>
                          <p className="text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Seguro
                          </p>
                          <p className={`font-medium ${insuranceStatus.color}`}>{insuranceStatus.label}</p>
                        </div>
                      )}
                      {inspectionStatus && (
                        <div>
                          <p className="text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Inspeção
                          </p>
                          <p className={`font-medium ${inspectionStatus.color}`}>{inspectionStatus.label}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenForm(vehicle)}
                        className="p-2 hover:bg-gray-100 rounded text-gray-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(vehicle.id)}
                        className="p-2 hover:bg-red-100 rounded text-red-600"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedVehicle ? 'Editar Veículo' : 'Adicionar Veículo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Marca *</Label>
                <Input value={formData.brand} onChange={e => setFormData(p => ({ ...p, brand: e.target.value }))} placeholder="Ex: Toyota" />
              </div>
              <div>
                <Label className="text-xs">Modelo *</Label>
                <Input value={formData.model} onChange={e => setFormData(p => ({ ...p, model: e.target.value }))} placeholder="Ex: Prius" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Matrícula *</Label>
                <Input value={formData.license_plate} onChange={e => setFormData(p => ({ ...p, license_plate: e.target.value }))} placeholder="XX-XX-XX" />
              </div>
              <div>
                <Label className="text-xs">Cor</Label>
                <Input value={formData.color} onChange={e => setFormData(p => ({ ...p, color: e.target.value }))} placeholder="Cor" />
              </div>
            </div>
            <div>
              <Label className="text-xs">VIN</Label>
              <Input value={formData.vin} onChange={e => setFormData(p => ({ ...p, vin: e.target.value }))} placeholder="Número de identificação" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Combustível</Label>
                <select value={formData.fuel_type} onChange={e => setFormData(p => ({ ...p, fuel_type: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm">
                  {FUEL_OPTIONS.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Estado</Label>
                <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm">
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Validade Seguro</Label>
                <Input type="date" value={formData.insurance_expiry} onChange={e => setFormData(p => ({ ...p, insurance_expiry: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Validade Inspeção</Label>
                <Input type="date" value={formData.inspection_expiry} onChange={e => setFormData(p => ({ ...p, inspection_expiry: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Preço Aluguel Semanal (€)</Label>
              <Input type="number" step="0.01" value={formData.weekly_rental_price} onChange={e => setFormData(p => ({ ...p, weekly_rental_price: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs">Atribuir Motorista</Label>
              <select value={formData.assigned_driver_id} onChange={e => setFormData(p => ({ ...p, assigned_driver_id: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm">
                <option value="">Nenhum</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleCloseForm}>Cancelar</Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending || !formData.brand || !formData.model || !formData.license_plate}>
                {createMutation.isPending || updateMutation.isPending ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}