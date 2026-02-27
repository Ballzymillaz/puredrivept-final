import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Calendar, Users, Clock, AlertCircle } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { createPageUrl } from '@/utils';

export default function VehicleAssignmentHistory({ currentUser }) {
  const isAdmin = currentUser?.role?.includes('admin');
  const isFleetManager = currentUser?.role?.includes('fleet_manager');

  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  // Fetch vehicles
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => await base44.entities.Vehicle.list(),
  });

  // Fetch assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => await base44.entities.VehicleAssignment.list('-assignment_date'),
  });

  // Fetch drivers for reference
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => await base44.entities.Driver.list(),
  });

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const vehicleAssignments = selectedVehicle 
    ? assignments.filter(a => a.vehicle_id === selectedVehicle.id)
    : [];

  // Calculate vehicle statistics
  const calculateVehicleStats = () => {
    if (!selectedVehicle || vehicleAssignments.length === 0) {
      return null;
    }

    const totalAssignments = vehicleAssignments.length;
    const uniqueDrivers = new Set(vehicleAssignments.map(a => a.driver_id)).size;
    
    const totalDays = vehicleAssignments.reduce((sum, a) => {
      const startDate = new Date(a.assignment_date);
      const endDate = a.end_date ? new Date(a.end_date) : new Date();
      return sum + differenceInDays(endDate, startDate);
    }, 0);

    const avgDurationPerDriver = (totalDays / totalAssignments).toFixed(0);

    const startDate = new Date(Math.min(...vehicleAssignments.map(a => new Date(a.assignment_date))));
    const endDate = new Date(Math.max(...vehicleAssignments.map(a => a.end_date ? new Date(a.end_date) : new Date())));

    return {
      totalAssignments,
      uniqueDrivers,
      totalDays,
      avgDurationPerDriver,
      earliestStart: startDate,
      latestEnd: endDate,
    };
  };

  const stats = calculateVehicleStats();

  if (!isAdmin && !isFleetManager) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Acesso restrito a administradores e gestores de frota</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <a href={createPageUrl('VehicleAssignment')} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </a>
        </Button>
      </div>

      <PageHeader
        title="Histórico de Atribuições de Veículos"
        subtitle="Consulte o histórico completo de motoristas por veículo"
      />

      {/* Vehicle Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecionar Veículo</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um veículo..." />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map(vehicle => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.license_plate} - {vehicle.brand} {vehicle.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedVehicle && stats && (
        <>
          {/* Statistics Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Total Atribuições</p>
                  <p className="text-3xl font-bold text-indigo-600">{stats.totalAssignments}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Users className="w-5 h-5 text-blue-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Motoristas Únicos</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.uniqueDrivers}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Dias Totais</p>
                  <p className="text-3xl font-bold text-emerald-600">{stats.totalDays}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Duração Média</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.avgDurationPerDriver} dias</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vehicle Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Informações do Veículo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Matrícula</p>
                  <p className="font-semibold text-sm text-gray-900">{selectedVehicle.license_plate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Marca/Modelo</p>
                  <p className="font-semibold text-sm text-gray-900">{selectedVehicle.brand} {selectedVehicle.model}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Status</p>
                  <Badge className={`text-xs ${
                    selectedVehicle.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                    selectedVehicle.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedVehicle.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Combustível</p>
                  <p className="font-semibold text-sm text-gray-900">{selectedVehicle.fuel_type}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Quilometragem</p>
                  <p className="font-semibold text-sm text-gray-900">{selectedVehicle.mileage?.toLocaleString() || 'N/A'} km</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">1ª Matriculação</p>
                  <p className="font-semibold text-sm text-gray-900">
                    {selectedVehicle.first_registration_date 
                      ? format(new Date(selectedVehicle.first_registration_date), 'dd/MM/yyyy')
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assignments Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Histórico de Motoristas</CardTitle>
            </CardHeader>
            <CardContent>
              {vehicleAssignments.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhuma atribuição encontrada</p>
              ) : (
                <div className="space-y-3">
                  {vehicleAssignments.map((assignment) => {
                    const driver = drivers.find(d => d.id === assignment.driver_id);
                    const daysUsed = assignment.end_date 
                      ? differenceInDays(new Date(assignment.end_date), new Date(assignment.assignment_date))
                      : differenceInDays(new Date(), new Date(assignment.assignment_date));

                    return (
                      <div key={assignment.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={`text-xs ${
                                assignment.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {assignment.status === 'active' ? 'Ativa' : 'Finalizada'}
                              </Badge>
                              <p className="font-semibold text-sm">{driver?.full_name || 'Motorista não encontrado'}</p>
                            </div>
                            <p className="text-xs text-gray-600">
                              {driver?.email}
                            </p>
                            {driver && (
                              <p className="text-xs text-gray-600 mt-1">
                                Contrato: <span className="font-semibold">{driver.contract_type}</span>
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500 font-semibold">{daysUsed} dias</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-600 mt-3 pt-3 border-t">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Início: {format(new Date(assignment.assignment_date), 'dd/MM/yyyy')}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Fim: {assignment.end_date ? format(new Date(assignment.end_date), 'dd/MM/yyyy') : 'Em curso'}
                          </div>
                        </div>

                        {assignment.notes && (
                          <p className="text-xs text-gray-600 mt-2 italic">Notas: {assignment.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Period Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Período de Serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                Este veículo esteve em serviço de <strong>{format(stats.earliestStart, 'dd/MM/yyyy')}</strong> a <strong>{format(stats.latestEnd, 'dd/MM/yyyy')}</strong>, 
                sendo utilizado por <strong>{stats.uniqueDrivers}</strong> motorista{stats.uniqueDrivers !== 1 ? 's' : ''} em <strong>{stats.totalAssignments}</strong> atribuição{stats.totalAssignments !== 1 ? 'ões' : ''}.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {selectedVehicle && !stats && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Este veículo não tem atribuições registadas
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}