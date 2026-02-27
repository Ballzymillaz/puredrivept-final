import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Car, Loader2, CheckCircle2 } from 'lucide-react';

export default function VehicleAssignmentStep({ onboarding, isAdmin, onUpdate }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-available'],
    queryFn: () => base44.entities.Vehicle.filter({ status: 'available' }),
    enabled: isAdmin,
  });

  const vehicleStatus = onboarding.vehicle_assignment_status || 'pending';

  const handleAssign = async () => {
    if (!selectedVehicleId) return;
    setSaving(true);
    const vehicle = vehicles.find(v => v.id === selectedVehicleId);
    const vehicleInfo = `${vehicle.brand} ${vehicle.model} - ${vehicle.license_plate}`;

    // Update onboarding
    await base44.entities.DriverOnboarding.update(onboarding.id, {
      vehicle_assignment_status: 'assigned',
      assigned_vehicle_id: selectedVehicleId,
      assigned_vehicle_info: vehicleInfo,
      current_step: 'completed',
      status: 'completed',
      completed_date: new Date().toISOString().split('T')[0],
    });

    // Update driver
    const drivers = await base44.entities.Driver.filter({ id: onboarding.driver_id });
    if (drivers.length > 0) {
      await base44.entities.Driver.update(onboarding.driver_id, {
        assigned_vehicle_id: selectedVehicleId,
        assigned_vehicle_plate: vehicle.license_plate,
        status: 'active',
      });
    }

    // Update vehicle
    await base44.entities.Vehicle.update(selectedVehicleId, {
      status: 'assigned',
      assigned_driver_id: onboarding.driver_id,
      assigned_driver_name: onboarding.driver_name,
    });

    // Notify
    await base44.functions.invoke('onboardingNotify', {
      onboardingId: onboarding.id,
      step: 'vehicle_assigned',
      driverName: onboarding.driver_name,
      driverEmail: onboarding.driver_email,
    });

    setSaving(false);
    onUpdate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Atribuição de Veículo</h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          vehicleStatus === 'assigned' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {vehicleStatus === 'assigned' ? 'Atribuído' : 'Pendente'}
        </span>
      </div>

      {vehicleStatus === 'assigned' ? (
        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">Veículo atribuído</p>
            <p className="text-sm text-emerald-700 mt-1">{onboarding.assigned_vehicle_info}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 flex gap-3">
            <Car className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Aguarda atribuição de veículo</p>
              <p className="text-xs text-amber-600 mt-1">
                {isAdmin ? 'Selecione um veículo disponível para atribuir a este motorista.' : 'A equipa irá atribuir um veículo em breve.'}
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500">Veículo disponível</Label>
                <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar veículo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.brand} {v.model} — {v.license_plate} {v.fuel_type ? `(${v.fuel_type})` : ''}
                      </SelectItem>
                    ))}
                    {vehicles.length === 0 && <SelectItem value="_none" disabled>Nenhum veículo disponível</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAssign}
                disabled={saving || !selectedVehicleId}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Atribuir veículo e concluir onboarding
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}