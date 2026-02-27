import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Truck, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

export default function FleetManagerDashboard({ currentUser }) {
  const fleetManagerId = currentUser?.linked_entity_id;

  // Fetch fleet managers
  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleetManagers'],
    queryFn: () => base44.entities.FleetManager.list(),
  });

  // Fetch drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  // Fetch vehicles
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  // Fetch maintenance records
  const { data: maintenanceRecords = [] } = useQuery({
    queryKey: ['maintenanceRecords'],
    queryFn: () => base44.entities.MaintenanceRecord.list(),
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.WeeklyPayment.list(),
  });

  // Filter data for current fleet manager
  const fleetDrivers = drivers.filter(d => d.fleet_manager_id === fleetManagerId);
  const fleetVehicles = vehicles.filter(v => v.fleet_manager_id === fleetManagerId);
  const fleetPayments = payments.filter(p => p.fleet_manager_id === fleetManagerId);
  const fleetMaintenance = maintenanceRecords.filter(m => 
    fleetVehicles.some(v => v.id === m.vehicle_id)
  );

  // Calculate KPIs
  const kpis = useMemo(() => {
    const activeDrivers = fleetDrivers.filter(d => d.status === 'active').length;
    const assignedVehicles = fleetVehicles.filter(v => v.status === 'assigned').length;
    const maintenanceNeeded = fleetMaintenance.filter(m => {
      const nextDate = new Date(m.next_service_date);
      return nextDate < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }).length;
    const totalRevenue = fleetPayments.reduce((sum, p) => sum + (p.company_revenue || 0), 0);

    return { activeDrivers, assignedVehicles, maintenanceNeeded, totalRevenue };
  }, [fleetDrivers, fleetVehicles, fleetMaintenance, fleetPayments]);

  // Driver status breakdown
  const driverStatusData = useMemo(() => {
    const statuses = ['active', 'pending', 'inactive', 'suspended'];
    return statuses.map(status => ({
      name: status === 'active' ? 'Ativo' : 
             status === 'pending' ? 'Pendente' :
             status === 'inactive' ? 'Inativo' : 'Suspenso',
      value: fleetDrivers.filter(d => d.status === status).length,
    })).filter(d => d.value > 0);
  }, [fleetDrivers]);

  // Vehicle status breakdown
  const vehicleStatusData = useMemo(() => {
    const statuses = ['assigned', 'available', 'maintenance', 'inactive'];
    return statuses.map(status => ({
      name: status === 'assigned' ? 'Atribuído' :
             status === 'available' ? 'Disponível' :
             status === 'maintenance' ? 'Manutenção' : 'Inativo',
      value: fleetVehicles.filter(v => v.status === status).length,
    })).filter(d => d.value > 0);
  }, [fleetVehicles]);

  // Monthly revenue trend
  const monthlyRevenue = useMemo(() => {
    const byMonth = {};
    fleetPayments.forEach(p => {
      if (!p.week_start) return;
      const date = new Date(p.week_start);
      const month = date.toLocaleString('pt-PT', { month: 'short', year: '2-digit' });
      byMonth[month] = (byMonth[month] || 0) + (p.company_revenue || 0);
    });
    return Object.entries(byMonth).map(([month, revenue]) => ({ month, revenue })).slice(-6);
  }, [fleetPayments]);

  // Upcoming maintenance
  const upcomingMaintenance = useMemo(() => {
    return fleetMaintenance
      .filter(m => m.next_service_date)
      .sort((a, b) => new Date(a.next_service_date) - new Date(b.next_service_date))
      .slice(0, 5);
  }, [fleetMaintenance]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dashboard de Frota" 
        subtitle="Visão geral do desempenho e status da sua frota"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Motoristas Ativos</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.activeDrivers}</p>
              </div>
              <Users className="w-10 h-10 text-indigo-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Veículos Atribuídos</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.assignedVehicles}</p>
              </div>
              <Truck className="w-10 h-10 text-emerald-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Manutenção Próxima</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.maintenanceNeeded}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-yellow-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Receita Empresa</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">€{kpis.totalRevenue.toFixed(0)}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receita Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `€${value.toFixed(2)}`} />
                  <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-500 py-8">Sem dados disponíveis</p>
            )}
          </CardContent>
        </Card>

        {/* Driver Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status dos Motoristas</CardTitle>
          </CardHeader>
          <CardContent>
            {driverStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={driverStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {driverStatusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-500 py-8">Sem dados disponíveis</p>
            )}
          </CardContent>
        </Card>

        {/* Vehicle Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status dos Veículos</CardTitle>
          </CardHeader>
          <CardContent>
            {vehicleStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={vehicleStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-500 py-8">Sem dados disponíveis</p>
            )}
          </CardContent>
        </Card>

        {/* Driver Availability */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Disponibilidade de Motoristas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Ativos</span>
              <span className="text-2xl font-bold text-emerald-600">{fleetDrivers.filter(d => d.status === 'active').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pendentes</span>
              <span className="text-2xl font-bold text-yellow-600">{fleetDrivers.filter(d => d.status === 'pending').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Inativos</span>
              <span className="text-2xl font-bold text-gray-600">{fleetDrivers.filter(d => d.status === 'inactive').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Suspensos</span>
              <span className="text-2xl font-bold text-red-600">{fleetDrivers.filter(d => d.status === 'suspended').length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manutenção Programada (Próximos 30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingMaintenance.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nenhuma manutenção programada nos próximos 30 dias</p>
          ) : (
            <div className="space-y-3">
              {upcomingMaintenance.map(record => (
                <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{record.vehicle_info}</p>
                    <p className="text-xs text-gray-500 mt-1">{record.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(record.next_service_date).toLocaleDateString('pt-PT')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{record.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}