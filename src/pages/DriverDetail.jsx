import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useParams, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, Save } from 'lucide-react';

export default function DriverDetail() {
  const navigate = useNavigate();
  const { driverId } = useParams();
  const queryClient = useQueryClient();
  
  const [vehicleData, setVehicleData] = useState({
    license_plate: '',
    brand: '',
    model: '',
    first_registration_date: '',
  });
  const [editingVehicle, setEditingVehicle] = useState(false);

  // Fetch driver
  const { data: driver, isLoading: driverLoading } = useQuery({
    queryKey: ['driver', driverId],
    queryFn: async () => {
      const drivers = await base44.entities.Driver.list();
      return drivers.find(d => d.id === driverId);
    },
  });

  // Fetch vehicles
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  // Fetch assigned vehicle if exists
  const assignedVehicle = driver?.assigned_vehicle_id 
    ? vehicles.find(v => v.id === driver.assigned_vehicle_id)
    : null;

  // Update vehicle mutation
  const updateVehicleMutation = useMutation({
    mutationFn: async (data) => {
      if (assignedVehicle) {
        // Update existing vehicle
        await base44.entities.Vehicle.update(assignedVehicle.id, data);
      } else {
        // Create new vehicle and assign to driver
        const newVehicle = await base44.entities.Vehicle.create({
          ...data,
          fleet_manager_id: driver?.fleet_manager_id,
          assigned_driver_id: driver?.id,
          assigned_driver_name: driver?.full_name,
          status: 'assigned',
        });
        await base44.entities.Driver.update(driver.id, { 
          assigned_vehicle_id: newVehicle.id,
          assigned_vehicle_plate: data.license_plate,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver', driverId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setEditingVehicle(false);
      setVehicleData({
        license_plate: '',
        brand: '',
        model: '',
        first_registration_date: '',
      });
    },
  });

  // Initialize form with existing vehicle data
  React.useEffect(() => {
    if (assignedVehicle && editingVehicle) {
      setVehicleData({
        license_plate: assignedVehicle.license_plate || '',
        brand: assignedVehicle.brand || '',
        model: assignedVehicle.model || '',
        first_registration_date: assignedVehicle.first_registration_date || '',
      });
    }
  }, [assignedVehicle, editingVehicle]);

  const handleSaveVehicle = (e) => {
    e.preventDefault();
    if (!vehicleData.license_plate || !vehicleData.brand || !vehicleData.model) {
      return;
    }
    updateVehicleMutation.mutate(vehicleData);
  };

  if (driverLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">A carregar...</div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Motorista não encontrado</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button 
        variant="ghost" 
        onClick={() => navigate(createPageUrl('Drivers'))}
        className="gap-2 text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" /> Voltar
      </Button>

      <PageHeader 
        title={driver.full_name} 
        subtitle={driver.email}
      />

      {/* Driver Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações do Motorista</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <div>
            <Label className="text-xs text-gray-500">Nome completo</Label>
            <p className="font-medium mt-1">{driver.full_name}</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Email</Label>
            <p className="font-medium mt-1">{driver.email}</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Telefone</Label>
            <p className="font-medium mt-1">{driver.phone || '—'}</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">NIF</Label>
            <p className="font-medium mt-1">{driver.nif || '—'}</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Tipo de contrato</Label>
            <p className="font-medium mt-1">{driver.contract_type || '—'}</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Estado</Label>
            <p className="font-medium mt-1 capitalize">{driver.status}</p>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Veículo Atribuído</CardTitle>
        </CardHeader>
        <CardContent>
          {editingVehicle ? (
            <form onSubmit={handleSaveVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Matrícula *</Label>
                  <Input
                    value={vehicleData.license_plate}
                    onChange={(e) => setVehicleData(prev => ({ ...prev, license_plate: e.target.value }))}
                    placeholder="AA-00-AA"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Marca *</Label>
                  <Input
                    value={vehicleData.brand}
                    onChange={(e) => setVehicleData(prev => ({ ...prev, brand: e.target.value }))}
                    placeholder="ex. Toyota"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Modelo *</Label>
                  <Input
                    value={vehicleData.model}
                    onChange={(e) => setVehicleData(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="ex. Prius"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Primeira Matrícula</Label>
                  <Input
                    type="date"
                    value={vehicleData.first_registration_date}
                    onChange={(e) => setVehicleData(prev => ({ ...prev, first_registration_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setEditingVehicle(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={updateVehicleMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  <Save className="w-4 h-4" />
                  Guardar veículo
                </Button>
              </div>
            </form>
          ) : assignedVehicle ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-xs text-gray-500">Matrícula</Label>
                  <p className="font-medium mt-1">{assignedVehicle.license_plate}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Marca</Label>
                  <p className="font-medium mt-1">{assignedVehicle.brand}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Modelo</Label>
                  <p className="font-medium mt-1">{assignedVehicle.model}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Primeira Matrícula</Label>
                  <p className="font-medium mt-1">{assignedVehicle.first_registration_date || '—'}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={() => setEditingVehicle(true)}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Editar veículo
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Nenhum veículo atribuído</p>
              <Button 
                onClick={() => setEditingVehicle(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Atribuir veículo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}