import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Calendar, Gauge, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { createPageUrl } from '@/utils';

export default function DriverAssignmentHistory({ currentUser }) {
  const isAdmin = currentUser?.role?.includes('admin');
  const isFleetManager = currentUser?.role?.includes('fleet_manager');

  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Fetch drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => await base44.entities.Driver.list(),
  });

  // Fetch assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => await base44.entities.VehicleAssignment.list('-assignment_date'),
  });

  // Fetch vehicles for reference
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => await base44.entities.Vehicle.list(),
  });

  const selectedDriver = drivers.find(d => d.id === selectedDriverId);
  const driverAssignments = selectedDriver 
    ? assignments.filter(a => a.driver_id === selectedDriver.id)
    : [];

  // Calculate statistics
  const calculateStats = () => {
    if (!selectedDriver || driverAssignments.length === 0) {
      return null;
    }

    // Total assignments
    const totalAssignments = driverAssignments.length;

    // Calculate total days
    const totalDays = driverAssignments.reduce((sum, a) => {
      const startDate = new Date(a.assignment_date);
      const endDate = a.end_date ? new Date(a.end_date) : new Date();
      return sum + differenceInDays(endDate, startDate);
    }, 0);

    // Estimated total km (assuming 100km per day average)
    const estimatedTotalKm = totalDays * 100;

    // Assignments per year (if data spans multiple years)
    const startDate = new Date(Math.min(...driverAssignments.map(a => new Date(a.assignment_date))));
    const endDate = new Date(Math.max(...driverAssignments.map(a => a.end_date ? new Date(a.end_date) : new Date())));
    const yearsDiff = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365);
    const avgAssignmentsPerYear = yearsDiff > 0 ? (totalAssignments / yearsDiff).toFixed(1) : totalAssignments;

    // Average assignment duration
    const avgDuration = (totalDays / totalAssignments).toFixed(0);

    return {
      totalAssignments,
      totalDays,
      estimatedTotalKm,
      avgAssignmentsPerYear,
      avgDuration,
      earliestStart: startDate,
      latestEnd: endDate,
    };
  };

  const stats = calculateStats();

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
        title="Histórico de Atribuições de Motoristas"
        subtitle="Consulte o histórico completo de atribuições e estatísticas"
      />

      {/* Driver Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecionar Motorista</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um motorista..." />
            </SelectTrigger>
            <SelectContent>
              {drivers.map(driver => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.full_name} ({driver.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedDriver && stats && (
        <>
          {/* Statistics Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Total de Atribuições</p>
                  <p className="text-3xl font-bold text-indigo-600">{stats.totalAssignments}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Dias Totais</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.totalDays}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Gauge className="w-5 h-5 text-emerald-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">KM Estimados</p>
                  <p className="text-2xl font-bold text-emerald-600">{(stats.estimatedTotalKm / 1000).toFixed(1)}k</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <TrendingUp className="w-5 h-5 text-purple-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Média por Ano</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.avgAssignmentsPerYear}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Informações Adicionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Duração Média de Atribuição</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{stats.avgDuration} dias</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Período Ativo</p>
                  <p className="text-sm text-gray-700 mt-1">
                    {format(stats.earliestStart, 'dd/MM/yyyy')} a {format(stats.latestEnd, 'dd/MM/yyyy')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Driver Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Informações do Motorista</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Nome</p>
                  <p className="font-semibold text-sm text-gray-900">{selectedDriver.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Email</p>
                  <p className="font-semibold text-sm text-gray-900">{selectedDriver.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Status</p>
                  <Badge className={`text-xs ${
                    selectedDriver.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    selectedDriver.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedDriver.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Tipo Contrato</p>
                  <p className="font-semibold text-sm text-gray-900">{selectedDriver.contract_type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Telemóvel</p>
                  <p className="font-semibold text-sm text-gray-900">{selectedDriver.phone || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assignments Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Histórico Completo de Atribuições</CardTitle>
            </CardHeader>
            <CardContent>
              {driverAssignments.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhuma atribuição encontrada</p>
              ) : (
                <div className="space-y-3">
                  {driverAssignments.map((assignment, idx) => {
                    const vehicle = vehicles.find(v => v.id === assignment.vehicle_id);
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
                              <p className="font-semibold text-sm">{vehicle?.license_plate || 'Veículo não encontrado'}</p>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">
                              {vehicle?.brand} {vehicle?.model}
                            </p>
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
        </>
      )}

      {selectedDriver && !stats && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Este motorista não tem atribuições registadas
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}