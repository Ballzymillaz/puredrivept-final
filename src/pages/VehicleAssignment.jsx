import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, History, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function VehicleAssignment({ currentUser }) {
  const isAdmin = currentUser?.role?.includes('admin');
  const qc = useQueryClient();

  const [showMatchingDialog, setShowMatchingDialog] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // Fetch data
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => await base44.entities.Driver.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => await base44.entities.Vehicle.list(),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => await base44.entities.VehicleAssignment.list('-assignment_date'),
  });

  const { data: swapRequests = [] } = useQuery({
    queryKey: ['swap-requests'],
    queryFn: async () => await base44.entities.VehicleSwapRequest.list(),
  });

  // Create assignment mutation
  const assignmentMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.VehicleAssignment.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      setSelectedDriver(null);
      setSelectedVehicle(null);
      setShowMatchingDialog(false);
    },
  });

  // Intelligent vehicle matching algorithm
  const getMatchingVehicles = (driver) => {
    if (!driver) return [];

    const availableVehicles = vehicles.filter(v => v.status === 'available');
    
    // Score vehicles based on match criteria
    const scored = availableVehicles.map(vehicle => {
      let score = 0;

      // Contract type matching (highest priority)
      if (driver.contract_type === 'slot_black' && vehicle.model.toLowerCase().includes('tesla')) score += 50;
      if (driver.contract_type === 'slot_premium' && ['mercedes', 'audi', 'bmw'].some(b => vehicle.brand?.toLowerCase().includes(b))) score += 40;
      if (driver.contract_type === 'slot_standard') score += 20;

      // Fuel efficiency for location contracts
      if (driver.contract_type === 'location' && ['hybrid', 'electric'].includes(vehicle.fuel_type)) score += 30;

      // Recently maintained vehicles
      if (vehicle.last_maintenance_date) {
        const daysSinceService = Math.floor((Date.now() - new Date(vehicle.last_maintenance_date)) / (1000 * 60 * 60 * 24));
        if (daysSinceService < 30) score += 15;
      }

      // Low mileage preference
      if (!vehicle.mileage || vehicle.mileage < 150000) score += 10;

      return { vehicle, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .map(s => ({ ...s.vehicle, matchScore: s.score }));
  };

  const matchedVehicles = selectedDriver ? getMatchingVehicles(selectedDriver) : [];

  const handleAssign = async () => {
    if (!selectedDriver || !selectedVehicle) return;

    assignmentMutation.mutate({
      driver_id: selectedDriver.id,
      driver_name: selectedDriver.full_name,
      driver_email: selectedDriver.email,
      vehicle_id: selectedVehicle.id,
      vehicle_plate: selectedVehicle.license_plate,
      vehicle_info: `${selectedVehicle.brand} ${selectedVehicle.model} - ${selectedVehicle.license_plate}`,
      contract_type: selectedDriver.contract_type,
      assignment_date: new Date().toISOString().split('T')[0],
      status: 'active',
    });
  };

  const activeAssignments = assignments.filter(a => a.status === 'active');
  const pendingSwaps = swapRequests.filter(r => r.status === 'pending');

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atribuição de Veículos"
        subtitle="Gerir atribuições e trocas com matching inteligente"
        actionLabel="Nova Atribuição"
        onAction={() => setShowMatchingDialog(true)}
        actionIcon={Zap}
      />

      <Tabs defaultValue="assignments" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assignments">Atribuições Ativas ({activeAssignments.length})</TabsTrigger>
          <TabsTrigger value="swaps">Pedidos de Troca ({pendingSwaps.length})</TabsTrigger>
        </TabsList>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          {activeAssignments.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-gray-500">Nenhuma atribuição ativa</p>
              </CardContent>
            </Card>
          ) : (
            activeAssignments.map((assignment) => {
              const assignmentHistory = assignments.filter(a => a.driver_id === assignment.driver_id);
              return (
                <Card key={assignment.id}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Motorista</p>
                        <p className="font-semibold text-sm">{assignment.driver_name}</p>
                        <p className="text-xs text-gray-600">{assignment.driver_email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Veículo</p>
                        <p className="font-semibold text-sm">{assignment.vehicle_plate}</p>
                        <p className="text-xs text-gray-600">{assignment.vehicle_info}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Data Atribuição</p>
                        <p className="font-semibold text-sm">{new Date(assignment.assignment_date).toLocaleDateString('pt-PT')}</p>
                        <p className="text-xs text-gray-600">
                          <History className="w-3 h-3 inline mr-1" />
                          {assignmentHistory.length} atribuição(ões) anterior(es)
                        </p>
                      </div>
                      <div className="flex items-center justify-end">
                        <Badge className="bg-emerald-100 text-emerald-700">Ativa</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Swaps Tab */}
        <TabsContent value="swaps" className="space-y-4">
          {pendingSwaps.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-gray-500">Nenhum pedido de troca pendente</p>
              </CardContent>
            </Card>
          ) : (
            pendingSwaps.map((swap) => (
              <Card key={swap.id}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{swap.driver_name}</p>
                        <p className="text-xs text-gray-600">{swap.driver_email}</p>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-700">Pendente</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">De: {swap.current_vehicle_plate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Para: {swap.requested_vehicle_plate}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">Motivo: {swap.reason}</p>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm">Rejeitar</Button>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">Aprovar</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Matching Dialog */}
      <Dialog open={showMatchingDialog} onOpenChange={setShowMatchingDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Atribuição com Matching Inteligente</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Driver Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Selecionar Motorista</label>
              <Select value={selectedDriver?.id || ''} onValueChange={(id) => {
                const driver = drivers.find(d => d.id === id);
                setSelectedDriver(driver);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um motorista..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers.filter(d => d.status === 'active').map(driver => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.full_name} ({driver.contract_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Suggested Vehicles */}
            {selectedDriver && matchedVehicles.length > 0 && (
              <div>
                <Alert className="border-blue-200 bg-blue-50 mb-4">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    {matchedVehicles.length} veículo(s) sugerido(s) com base no perfil do motorista
                  </AlertDescription>
                </Alert>

                <label className="block text-sm font-medium mb-2">Veículos Recomendados</label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {matchedVehicles.slice(0, 10).map(vehicle => (
                    <button
                      key={vehicle.id}
                      onClick={() => setSelectedVehicle(vehicle)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedVehicle?.id === vehicle.id
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{vehicle.brand} {vehicle.model}</p>
                          <p className="text-xs text-gray-600">{vehicle.license_plate} • {vehicle.fuel_type}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {vehicle.matchScore > 40 && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          <span className="text-xs font-semibold text-indigo-600">Match: {vehicle.matchScore}%</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowMatchingDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedDriver || !selectedVehicle || assignmentMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Confirmar Atribuição
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}