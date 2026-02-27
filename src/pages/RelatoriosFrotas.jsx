import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Users, Truck, DollarSign } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export default function RelatoriosFrotas({ currentUser }) {
  const [selectedFleetManager, setSelectedFleetManager] = useState('');
  const [dateRange, setDateRange] = useState('month');

  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleetmanagers-reports'],
    queryFn: () => base44.entities.FleetManager.list(),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-reports'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-reports'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start'),
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-reports'],
    queryFn: () => base44.entities.Contract.list(),
  });

  // Filter by fleet manager
  const filteredDrivers = selectedFleetManager
    ? drivers.filter(d => d.fleet_manager_id === selectedFleetManager)
    : drivers;

  const filteredPayments = payments.filter(p => 
    !selectedFleetManager || p.fleet_manager_id === selectedFleetManager
  );

  // Calculate KPIs
  const stats = {
    totalDrivers: filteredDrivers.length,
    totalGross: filteredPayments.reduce((sum, p) => sum + (p.total_gross || 0), 0),
    totalNet: filteredPayments.reduce((sum, p) => sum + (p.net_amount || 0), 0),
    avgGrossPerDriver: filteredPayments.length > 0 ? filteredPayments.reduce((sum, p) => sum + (p.total_gross || 0), 0) / new Set(filteredPayments.map(p => p.driver_id)).size : 0,
  };

  // Monthly evolution
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const monthlyData = daysInMonth.map(day => {
    const dayPayments = filteredPayments.filter(p => {
      const pDate = new Date(p.week_start);
      return pDate.toDateString() === day.toDateString();
    });
    return {
      date: format(day, 'dd/MM'),
      gross: dayPayments.reduce((sum, p) => sum + (p.total_gross || 0), 0),
      net: dayPayments.reduce((sum, p) => sum + (p.net_amount || 0), 0),
    };
  }).filter(d => d.gross > 0 || d.net > 0);

  // Drivers performance
  const driverPerformance = filteredDrivers.map(driver => {
    const driverPayments = filteredPayments.filter(p => p.driver_id === driver.id);
    return {
      name: driver.full_name,
      earnings: driverPayments.reduce((sum, p) => sum + (p.net_amount || 0), 0),
      weeks: driverPayments.length,
    };
  }).sort((a, b) => b.earnings - a.earnings).slice(0, 10);

  // Contract status
  const contractStatus = [
    { name: 'Ativo', value: contracts.filter(c => c.status === 'active').length },
    { name: 'Expirado', value: contracts.filter(c => c.status === 'expired').length },
    { name: 'Cancelado', value: contracts.filter(c => c.status === 'cancelled').length },
  ];

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios de Frota"
        subtitle="Análise de desempenho, motoristas e contratos"
      />

      <div className="bg-white rounded-lg border shadow-sm p-4">
        <Select value={selectedFleetManager} onValueChange={setSelectedFleetManager}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Selecionar gestor de frota..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Todas as frotas</SelectItem>
            {fleetManagers.map(fm => (
              <SelectItem key={fm.id} value={fm.id}>{fm.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500">Motoristas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span className="text-2xl font-bold text-gray-900">{stats.totalDrivers}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500">Receita Bruta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold text-gray-900">€{stats.totalGross.toFixed(0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500">Receita Líquida</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">€{stats.totalNet.toFixed(0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500">Média/Motorista</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <Truck className="w-5 h-5 text-purple-600" />
              <span className="text-2xl font-bold text-gray-900">€{stats.avgGrossPerDriver.toFixed(0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => `€${value.toFixed(0)}`} />
                <Legend />
                <Line type="monotone" dataKey="gross" stroke="#4f46e5" name="Bruto" />
                <Line type="monotone" dataKey="net" stroke="#10b981" name="Líquido" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Contract Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Estado dos Contratos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={contractStatus} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {contractStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Drivers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top 10 Motoristas</CardTitle>
        </CardHeader>
        <CardContent>
          {driverPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={driverPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={100} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => `€${value.toFixed(0)}`} />
                <Bar dataKey="earnings" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500">Sem dados disponíveis</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}